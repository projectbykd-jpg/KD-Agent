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
    "pateway": Provider(
        "pateway",
        "PatewayAI",
        "PATEWAY_API_KEY",
        "PATEWAY_MODEL",
        "https://api.pateway.ai/v1",
        "claude-sonnet-4-6",
        "anthropic_messages",
    ),
}


def default_provider() -> str:
    provider = os.getenv("AI_PROVIDER", "pateway").strip().casefold()
    return provider if provider in PROVIDERS else "pateway"


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


def _extract_anthropic_text(payload: dict[str, object]) -> str:
    content = payload.get("content")
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        result = "".join(parts).strip()
        if result:
            return result
    raise LLMError("PatewayAI mengembalikan respons tanpa teks yang dapat dibaca.")


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
        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()

    return raw[:600].strip() or reason or "Permintaan provider gagal."


def _max_tokens() -> int:
    raw = os.getenv("PATEWAY_MAX_TOKENS", "4096").strip()
    try:
        value = int(raw)
    except ValueError:
        return 4096
    return max(256, min(value, 32768))


def _pateway_messages(
    messages: list[dict[str, str]],
) -> tuple[str, list[dict[str, str]]]:
    system_text = ""
    result: list[dict[str, str]] = []

    for item in messages:
        role = item["role"]
        content = item["content"]
        if role == "system":
            system_text = content
            continue
        if role in {"user", "assistant"}:
            result.append({"role": role, "content": content})

    return system_text, result


def _pateway(
    provider: Provider,
    api_key: str,
    selected_model: str,
    messages: list[dict[str, str]],
) -> dict[str, object]:
    system_text, provider_messages = _pateway_messages(messages)

    request_body: dict[str, object] = {
        "model": selected_model,
        "max_tokens": _max_tokens(),
        "messages": provider_messages,
    }
    if system_text:
        request_body["system"] = system_text

    body = json.dumps(request_body).encode("utf-8")
    request = Request(
        f"{provider.base_url}/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": (
                "KD-Agent/0.1 "
                "(Python urllib; PatewayAI Anthropic Messages client)"
            ),
        },
        method="POST",
    )

    raw = _request(provider, request)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError("Respons PatewayAI bukan JSON yang valid.") from exc

    content = _extract_anthropic_text(payload)
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}

    return {
        "provider": provider.key,
        "provider_name": provider.label,
        "model": payload.get("model", selected_model),
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

    if any(char.isspace() for char in selected_model) or any(char in selected_model for char in '<>""\\'):
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

    if provider.protocol == "anthropic_messages":
        return _pateway(provider, api_key, selected_model, messages)

    raise LLMError(f"Protocol provider tidak didukung: {provider.protocol}")
