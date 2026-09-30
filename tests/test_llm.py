import json
import os
import unittest
from unittest.mock import patch

from kd_agent.llm import LLMError, chat, default_provider, provider_status


class LLMTests(unittest.TestCase):
    def test_pateway_is_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(default_provider(), "pateway")

    def test_provider_status_only_has_pateway(self):
        with patch.dict(
            os.environ,
            {"PATEWAY_API_KEY": "super-secret", "AI_PROVIDER": "pateway"},
            clear=True,
        ):
            status = provider_status()

        self.assertEqual(status["default_provider"], "pateway")
        self.assertEqual(
            [item["id"] for item in status["providers"]],
            ["pateway"],
        )
        self.assertTrue(status["providers"][0]["configured"])
        self.assertNotIn("super-secret", json.dumps(status))

    def test_missing_pateway_key_is_reported(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "pateway"}, clear=True):
            with self.assertRaises(LLMError):
                chat("hello")

    def test_invalid_provider_falls_back_to_pateway(self):
        with patch.dict(
            os.environ,
            {"AI_PROVIDER": "invalid", "PATEWAY_API_KEY": "x"},
            clear=True,
        ):
            self.assertEqual(default_provider(), "pateway")

    def test_pateway_anthropic_messages_request_and_response(self):
        response_payload = {
            "content": [{"type": "text", "text": "Halo dari PatewayAI"}],
            "model": "claude-sonnet-4-6",
            "usage": {"input_tokens": 3, "output_tokens": 4},
        }

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return json.dumps(response_payload).encode("utf-8")

        captured = {}

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["headers"] = dict(request.headers)
            captured["body"] = json.loads(request.data.decode("utf-8"))
            captured["timeout"] = timeout
            return FakeResponse()

        with patch.dict(
            os.environ,
            {
                "AI_PROVIDER": "pateway",
                "PATEWAY_API_KEY": "test-key",
                "PATEWAY_MODEL": "claude-sonnet-4-6",
                "PATEWAY_MAX_TOKENS": "4096",
            },
            clear=True,
        ):
            with patch("kd_agent.llm.urlopen", fake_urlopen):
                result = chat(
                    "hello",
                    history=[{"role": "user", "content": "previous"}],
                )

        self.assertEqual(result["provider"], "pateway")
        self.assertEqual(result["content"], "Halo dari PatewayAI")
        self.assertTrue(captured["url"].endswith("/v1/messages"))
        self.assertEqual(captured["headers"]["X-api-key"], "test-key")
        self.assertEqual(captured["body"]["model"], "claude-sonnet-4-6")
        self.assertEqual(captured["body"]["max_tokens"], 4096)
        self.assertEqual(captured["body"]["messages"][0]["role"], "user")
        self.assertEqual(captured["body"]["messages"][1]["role"], "user")
        self.assertIn("system", captured["body"])

    def test_invalid_model_falls_back_to_default(self):
        with patch.dict(
            os.environ,
            {
                "AI_PROVIDER": "pateway",
                "PATEWAY_API_KEY": "test-key",
                "PATEWAY_MODEL": "claude-sonnet-4-6",
            },
            clear=True,
        ):
            class FakeResponse:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc, tb):
                    return False

                def read(self):
                    return json.dumps(
                        {
                            "content": [{"type": "text", "text": "ok"}],
                            "model": "claude-sonnet-4-6",
                        }
                    ).encode("utf-8")

            def fake_urlopen(request, timeout):
                body = json.loads(request.data.decode("utf-8"))
                self.assertEqual(body["model"], "claude-sonnet-4-6")
                return FakeResponse()

            with patch("kd_agent.llm.urlopen", fake_urlopen):
                chat("hello", model="KD API")
            

if __name__ == "__main__":
    unittest.main()
