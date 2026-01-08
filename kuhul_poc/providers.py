from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple


class ProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str
    api_key_env: Optional[str]
    kind: str


PROVIDERS: Dict[str, ProviderConfig] = {
    "openai": ProviderConfig(
        name="openai",
        base_url="https://api.openai.com/v1",
        api_key_env="OPENAI_API_KEY",
        kind="openai",
    ),
    "mistral": ProviderConfig(
        name="mistral",
        base_url="https://api.mistral.ai/v1",
        api_key_env="MISTRAL_API_KEY",
        kind="openai",
    ),
    "deepseek": ProviderConfig(
        name="deepseek",
        base_url="https://api.deepseek.com/v1",
        api_key_env="DEEPSEEK_API_KEY",
        kind="openai",
    ),
    "codestral": ProviderConfig(
        name="codestral",
        base_url="https://codestral.mistral.ai/v1",
        api_key_env="CODESTRAL_API_KEY",
        kind="openai",
    ),
    "claude": ProviderConfig(
        name="claude",
        base_url="https://api.anthropic.com/v1",
        api_key_env="ANTHROPIC_API_KEY",
        kind="anthropic",
    ),
    "inference": ProviderConfig(
        name="inference",
        base_url="http://localhost:11434/v1",
        api_key_env="INFERENCE_API_KEY",
        kind="openai",
    ),
}


def request_chat(
    *,
    provider: str,
    model: str,
    message: str,
    system: Optional[str],
    temperature: float,
    max_tokens: int,
    base_url: Optional[str],
    api_key: Optional[str],
) -> Tuple[str, Dict[str, Any]]:
    if provider not in PROVIDERS:
        raise ProviderError(f"Unsupported provider: {provider}")

    config = PROVIDERS[provider]
    resolved_base = (base_url or config.base_url).rstrip("/")
    key = api_key or (os.getenv(config.api_key_env or "") if config.api_key_env else None)
    if config.api_key_env and not key:
        raise ProviderError(
            f"Missing API key. Set {config.api_key_env} or pass --api-key for {provider}."
        )

    if config.kind == "anthropic":
        return _request_anthropic(
            base_url=resolved_base,
            api_key=key,
            model=model,
            message=message,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    return _request_openai_compatible(
        base_url=resolved_base,
        api_key=key,
        model=model,
        message=message,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def _request_openai_compatible(
    *,
    base_url: str,
    api_key: Optional[str],
    model: str,
    message: str,
    system: Optional[str],
    temperature: float,
    max_tokens: int,
) -> Tuple[str, Dict[str, Any]]:
    url = f"{base_url}/chat/completions"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    data = _post_json(url, payload, headers)
    content = ""
    if isinstance(data, dict):
        choices = data.get("choices") or []
        if choices:
            first = choices[0]
            message_obj = first.get("message") or {}
            content = message_obj.get("content") or first.get("text") or ""
    if not content:
        raise ProviderError("Empty response from provider")
    return content, {"request_url": url}


def _request_anthropic(
    *,
    base_url: str,
    api_key: Optional[str],
    model: str,
    message: str,
    system: Optional[str],
    temperature: float,
    max_tokens: int,
) -> Tuple[str, Dict[str, Any]]:
    url = f"{base_url}/messages"
    payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": message}],
    }
    if system:
        payload["system"] = system

    headers = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    if api_key:
        headers["x-api-key"] = api_key

    data = _post_json(url, payload, headers)
    content = ""
    if isinstance(data, dict):
        parts = data.get("content") or []
        if parts:
            first = parts[0]
            content = first.get("text") or ""
    if not content:
        raise ProviderError("Empty response from provider")
    return content, {"request_url": url}


def _post_json(url: str, payload: Dict[str, Any], headers: Dict[str, str]) -> Any:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode("utf-8")
            return json.loads(text)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else exc.reason
        raise ProviderError(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ProviderError(f"Connection error: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise ProviderError("Invalid JSON response") from exc
