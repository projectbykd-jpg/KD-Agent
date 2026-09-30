from __future__ import annotations

import json
import os
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class LLMError(RuntimeError):
    """Raised when an LLM provider cannot complete a request."""


@dataclass(frozen=True)
class Provider:
    key: str
    label: str
    api_key_env: str
    model_env: str
    base_url: str
    default_model: str
    protocol: str = "chat_completions"


PROVIDERS: dict[str, Provider] = {
    "gemini": Provider(
        "gemini",
        "Google Gemini",
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "https://generativelanguage.googleapis.com/v1beta",
        "gemini-2.5-flash",
        "gemini",
    ),
    "groq": Provider(
        "groq",
        "Groq",
        "GROQ_API_KEY",
        "GROQ_MODEL",
        "https://api.groq.com/openai/v1",
        "openai/gpt-oss-120b",
        "chat_completions",
    ),
}


def default_provider() -> str:
    provider = os.getenv("AI_PROVIDER", "gemini").strip().casefold()
    return provider if provider in PROVIDERS else "gemini"


def _masked_status(provider: Provider) -> dict[str, object]:
    configured = bool(os.getenv(provider.api_key_env, "").strip())
    model = os.getenv(provider.model_env, provider.default_model).strip() or provider.default_model
    return {
        "id": provider.key,
        "name": provider.label,
        "configured": configured,
        "model": model,
        "api_key_env": provider.api_key_env,
    }


def provider_status() -> dict[str, object]:
    return {
        "default_provider": default_provider(),
        "providers": [_masked_status(provider) for provider in PROVIDERS.values()],
    }


def _provider(provider_name: str | None) -> Provider:
    name = (provider_name or default_provider()).strip().casefold()
    try:
        return PROVIDERS[name]
    except KeyError as exc:
        raise LLMError(f"Provider tidak dikenal: {name}") from exc


def _extract_chat_text(payload: dict[str, object]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content.strip()
                if isinstance(content, list):
                    parts: list[str] = []
                    for item in content:
                        if isinstance(item, dict):
                            text = item.get("text")
                            if isinstance(text, str):
                                parts.append(text)
                    return "".join(parts).strip()
    raise LLMError("Provider mengembalikan respons tanpa teks yang dapat dibaca.")


def _extract_gemini_text(payload: dict[str, object]) -> str:
    candidates = payload.get("candidates")
    if isinstance(candidates, list) and candidates:
        first = candidates[0]
        if isinstance(first, dict):
            content = first.get("content")
            if isinstance(content, dict):
                parts = content.get("parts")
                if isinstance(parts, list):
                    texts: list[str] = []
                    for part in parts:
                        if isinstance(part, dict):
                            text = part.get("text")
                            if isinstance(text, str):
                                texts.append(text)
                    result = "".join(texts).strip()
                    if result:
                        return result
    raise LLMError("Gemini mengembalikan respons tanpa teks yang dapat dibaca.")


def _gemini_content(
    messages: list[dict[str, str]],
) -> tuple[str, list[dict[str, object]]]:
    system_text = ""
    contents: list[dict[str, object]] = []

    for item in messages:
        role = item["role"]
        content = item["content"]
        if role == "system":
            system_text = content
            continue
        contents.append(
            {
                "role": "model" if role == "assistant" else "user",
                "parts": [{"text": content}],
            }
        )

    return system_text, contents


def _error_detail(provider: Provider, raw: str, reason: str | None = None) -> str:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()

    return raw[:600].strip() or reason or "Permintaan provider gagal."


def _chat_completions(
    provider: Provider,
    api_key: str,
    selected_model: str,
    messages: list[dict[str, str]],
) -> dict[str, object]:
    body = json.dumps(
        {
            "model": selected_model,
            "messages": messages,
        }
    ).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    request = Request(
        f"{provider.base_url}/chat/completions",
        data=body,
        headers=headers,
        method="POST",
    )

    raw = _request(provider, request)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Respons {provider.label} bukan JSON yang valid.") from exc

    content = _extract_chat_text(payload)
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}

    return {
        "provider": provider.key,
        "provider_name": provider.label,
        "model": payload.get("model", selected_model),
        "content": content,
        "usage": usage,
    }


def _gemini(
    provider: Provider,
    api_key: str,
    selected_model: str,
    messages: list[dict[str, str]],
) -> dict[str, object]:
    system_text, contents = _gemini_content(messages)

    request_body: dict[str, object] = {"contents": contents}
    if system_text:
        request_body["systemInstruction"] = {
            "parts": [{"text": system_text}],
        }

    body = json.dumps(request_body).encode("utf-8")
    request = Request(
        f"{provider.base_url}/models/{selected_model}:generateContent",
        data=body,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    raw = _request(provider, request)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError("Respons Google Gemini bukan JSON yang valid.") from exc

    content = _extract_gemini_text(payload)
    usage = payload.get("usageMetadata") if isinstance(payload.get("usageMetadata"), dict) else {}

    return {
        "provider": provider.key,
        "provider_name": provider.label,
        "model": selected_model,
        "content": content,
        "usage": usage,
    }


def _request(provider: Provider, request: Request) -> str:
    try:
        with urlopen(request, timeout=90) as response:
            return response.read().decode("utf-8")
    except HTTPError as exc:
        try:
            raw = exc.read().decode("utf-8")
        except Exception:
            raw = ""
        detail = _error_detail(provider, raw, str(exc.reason))
        raise LLMError(f"{provider.label} HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise LLMError(f"Gagal terhubung ke {provider.label}: {exc.reason}") from exc
    except TimeoutError as exc:
        raise LLMError(f"Timeout saat menghubungi {provider.label}.") from exc


def chat(
    prompt: str,
    *,
    provider_name: str | None = None,
    model: str | None = None,
    history: list[dict[str, str]] | None = None,
) -> dict[str, object]:
    prompt = prompt.strip()
    if not prompt:
        raise LLMError("Prompt tidak boleh kosong.")

    provider = _provider(provider_name)
    api_key = os.getenv(provider.api_key_env, "").strip()
    if not api_key:
        raise LLMError(
            f"{provider.label} belum dikonfigurasi. Isi {provider.api_key_env} di environment backend."
        )

    selected_model = (model or os.getenv(provider.model_env, provider.default_model)).strip()
    if not selected_model:
        selected_model = provider.default_model

    system_prompt = os.getenv(
        "KD_AGENT_SYSTEM_PROMPT",
        "Kamu adalah KD Agent, asisten AI yang membantu pengguna merencanakan, "
        "menjelaskan, dan menyelesaikan pekerjaan secara aman dan terstruktur. "
        "Jawab dalam bahasa pengguna kecuali diminta lain.",
    )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]

    if history:
        for item in history[-20:]:
            if not isinstance(item, dict):
                continue
            role = item.get("role", "")
            content = item.get("content", "")
            if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
                messages.append({"role": role, "content": content.strip()})

    messages.append({"role": "user", "content": prompt})

    if provider.protocol == "gemini":
        return _gemini(provider, api_key, selected_model, messages)

    return _chat_completions(provider, api_key, selected_model, messages)
