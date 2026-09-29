from __future__ import annotations

import json
import mimetypes
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .orchestrator import KDOrchestrator
from .registry import IntegrationRegistry


STATIC_DIR = Path(__file__).with_name("static")


class KDWebHandler(BaseHTTPRequestHandler):
    """Minimal dependency-free HTTP API and control-panel host."""

    server_version = "KDAgent/0.1"

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/v1/health":
            self._json(HTTPStatus.OK, {"service": "kd-agent-api", "status": "ok"})
            return
        if path == "/api/v1/integrations":
            self._json(HTTPStatus.OK, {"integrations": IntegrationRegistry().status()})
            return
        if path == "/api/status":
            self._json(HTTPStatus.OK, {"integrations": IntegrationRegistry().status()})
            return
        if path == "/" or path == "/index.html":
            self._static("index.html")
            return
        if path.startswith("/static/"):
            self._static(path.removeprefix("/static/"))
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Route not found"})

    def do_POST(self) -> None:  # noqa: N802
        if urlparse(self.path).path not in {"/api/plan", "/api/v1/plan"}:
            self._json(HTTPStatus.NOT_FOUND, {"error": "Route not found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(size))
            objective = payload.get("objective", "")
            result = KDOrchestrator().plan(objective).to_dict()
        except (ValueError, json.JSONDecodeError, AttributeError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        self._json(HTTPStatus.OK, result)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _json(self, status: HTTPStatus, payload: object) -> None:
        body = json.dumps(payload).encode("utf-8")
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
        configured_origin = os.getenv("KD_AGENT_ALLOWED_ORIGIN", "")
        request_origin = self.headers.get("Origin", "")
        if configured_origin and request_origin == configured_origin:
            self.send_header("Access-Control-Allow-Origin", configured_origin)
            self.send_header("Vary", "Origin")

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
