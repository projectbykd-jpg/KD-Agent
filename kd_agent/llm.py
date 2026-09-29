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


PROVIDERS: dict[str, Provider] = {
    "openai": Provider(
        "openai",
        "OpenAI",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "https://api.openai.com/v1",
        "gpt-5.6",
    ),
    "groq": Provider(
        "groq",
        "Groq",
        "GROQ_API_KEY",
        "GROQ_MODEL",
        "https://api.groq.com/openai/v1",
        "openai/gpt-oss-120b",
    ),
    "openrouter": Provider(
        "openrouter",
        "OpenRouter",
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL",
        "https://openrouter.ai/api/v1",
        "openrouter/auto",
    ),
}


def default_provider() -> str:
    provider = os.getenv("AI_PROVIDER", "openai").strip().casefold()
    return provider if provider in PROVIDERS else "openai"


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


def _extract_text(payload: dict[str, object]) -> str:
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

    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": os.getenv(
                "KD_AGENT_SYSTEM_PROMPT",
                "Kamu adalah KD Agent, asisten AI yang membantu pengguna merencanakan, "
                "menjelaskan, dan menyelesaikan pekerjaan secara aman dan terstruktur. "
                "Jawab dalam bahasa pengguna kecuali diminta lain.",
            ),
        }
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
    if provider.key == "openrouter":
        referer = os.getenv("OPENROUTER_HTTP_REFERER", "").strip()
        title = os.getenv("OPENROUTER_APP_TITLE", "KD Agent").strip()
        if referer:
            headers["HTTP-Referer"] = referer
        if title:
            headers["X-Title"] = title

    request = Request(
        f"{provider.base_url}/chat/completions",
        data=body,
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(request, timeout=90) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        try:
            raw = exc.read().decode("utf-8")
        except Exception:
            raw = ""
        detail = raw[:600] or str(exc.reason)
        raise LLMError(f"{provider.label} HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise LLMError(f"Gagal terhubung ke {provider.label}: {exc.reason}") from exc
    except TimeoutError as exc:
        raise LLMError(f"Timeout saat menghubungi {provider.label}.") from exc

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Respons {provider.label} bukan JSON yang valid.") from exc

    content = _extract_text(payload)
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
    return {
        "provider": provider.key,
        "provider_name": provider.label,
        "model": payload.get("model", selected_model),
        "content": content,
        "usage": usage,
    }
