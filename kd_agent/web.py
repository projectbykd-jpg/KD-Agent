from __future__ import annotations

import json
import mimetypes
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .llm import LLMError, chat, provider_status
from .orchestrator import KDOrchestrator
from .registry import IntegrationRegistry


STATIC_DIR = Path(__file__).with_name("static")
MAX_BODY_BYTES = 256_000


class KDWebHandler(BaseHTTPRequestHandler):
    """Minimal dependency-free HTTP API and control-panel host."""

    server_version = "KDAgent/0.2"

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/v1/health":
            self._json(
                HTTPStatus.OK,
                {
                    "service": "kd-agent-api",
                    "status": "ok",
                    "default_provider": provider_status()["default_provider"],
                },
            )
            return
        if path in {"/api/v1/integrations", "/api/status"}:
            self._json(HTTPStatus.OK, {"integrations": IntegrationRegistry().status()})
            return
        if path in {"/api/v1/providers", "/api/providers"}:
            self._json(HTTPStatus.OK, provider_status())
            return
        if path == "/" or path == "/index.html":
            self._static("index.html")
            return
        if path.startswith("/static/"):
            self._static(path.removeprefix("/static/"))
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Route not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in {"/api/plan", "/api/v1/plan"}:
            self._handle_plan()
            return
        if path in {"/api/chat", "/api/v1/chat"}:
            self._handle_chat()
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Route not found"})

    def _read_json(self) -> dict[str, object]:
        size = int(self.headers.get("Content-Length", "0"))
        if size <= 0 or size > MAX_BODY_BYTES:
            raise ValueError("Payload tidak valid atau terlalu besar.")
        payload = json.loads(self.rfile.read(size))
        if not isinstance(payload, dict):
            raise ValueError("Payload harus berupa object JSON.")
        return payload

    def _handle_plan(self) -> None:
        try:
            payload = self._read_json()
            objective = payload.get("objective", "")
            result = KDOrchestrator().plan(objective).to_dict()
        except (ValueError, json.JSONDecodeError, AttributeError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        self._json(HTTPStatus.OK, result)

    def _handle_chat(self) -> None:
        try:
            payload = self._read_json()
            prompt = payload.get("prompt", "")
            provider = payload.get("provider")
            model = payload.get("model")
            history = payload.get("history", [])
            if not isinstance(prompt, str):
                raise ValueError("Prompt harus berupa teks.")
            if provider is not None and not isinstance(provider, str):
                raise ValueError("Provider tidak valid.")
            if model is not None and not isinstance(model, str):
                raise ValueError("Model tidak valid.")
            if not isinstance(history, list):
                history = []
            result = chat(
                prompt,
                provider_name=provider,
                model=model,
                history=history,
            )
        except LLMError as error:
            self._json(HTTPStatus.BAD_GATEWAY, {"error": str(error)})
            return
        except (ValueError, json.JSONDecodeError, AttributeError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        self._json(HTTPStatus.OK, result)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors_headers()
        self.end_headers()

    def _json(self, status: HTTPStatus, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static(self, relative_path: str) -> None:
        candidate = (STATIC_DIR / relative_path).resolve()
        if STATIC_DIR.resolve() not in candidate.parents or not candidate.is_file():
            self._json(HTTPStatus.NOT_FOUND, {"error": "Asset not found"})
            return
        body = candidate.read_bytes()
        content_type, _ = mimetypes.guess_type(candidate.name)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self) -> None:
        # Keep production clients working even if Render's optional env var
        # is missing or stale. Extra origins can still be supplied via env.
        production_origins = {
            "https://projectbykd-jpg.github.io",
            "https://kd-agent-panel.onrender.com",
        }
        local_origins = {
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
        }
        configured_origins = (
            os.getenv("KD_AGENT_ALLOWED_ORIGINS")
            or os.getenv("KD_AGENT_ALLOWED_ORIGIN", "")
        )
        allowed_origins = production_origins | local_origins | {
            value.strip().rstrip("/")
            for value in configured_origins.replace("\n", ",").split(",")
            if value.strip()
        }
        request_origin = self.headers.get("Origin", "").strip().rstrip("/")
        if request_origin and request_origin in allowed_origins:
            self.send_header("Access-Control-Allow-Origin", request_origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
        self.send_header("Access-Control-Max-Age", "600")

    def log_message(self, format: str, *args: object) -> None:
        return


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), KDWebHandler)
    print(f"KD Agent panel available at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nKD Agent panel stopped.")
    finally:
        server.server_close()
