import json
import os
import unittest
from unittest.mock import patch

from kd_agent.llm import LLMError, chat, default_provider, provider_status


class LLMTests(unittest.TestCase):
    def test_gemini_is_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(default_provider(), "gemini")

    def test_provider_status_has_only_gemini_and_groq(self):
        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "super-secret", "AI_PROVIDER": "gemini"},
            clear=True,
        ):
            status = provider_status()

        self.assertEqual(status["default_provider"], "gemini")
        self.assertEqual(
            [item["id"] for item in status["providers"]],
            ["gemini", "groq"],
        )
        self.assertTrue(status["providers"][0]["configured"])
        self.assertNotIn("super-secret", json.dumps(status))

    def test_missing_gemini_key_is_reported(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini"}, clear=True):
            with self.assertRaises(LLMError):
                chat("hello")

    def test_invalid_provider_falls_back_to_gemini(self):
        with patch.dict(
            os.environ,
            {"AI_PROVIDER": "invalid", "GEMINI_API_KEY": "x"},
            clear=True,
        ):
            self.assertEqual(default_provider(), "gemini")

    def test_gemini_request_shape_and_response(self):
        response_payload = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Halo dari Gemini"}],
                    }
                }
            ],
            "usageMetadata": {"promptTokenCount": 3, "candidatesTokenCount": 4},
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
                "AI_PROVIDER": "gemini",
                "GEMINI_API_KEY": "test-key",
                "GEMINI_MODEL": "gemini-2.5-flash",
            },
            clear=True,
        ):
            with patch("kd_agent.llm.urlopen", fake_urlopen):
                result = chat("hello", history=[{"role": "user", "content": "previous"}])

        self.assertEqual(result["provider"], "gemini")
        self.assertEqual(result["content"], "Halo dari Gemini")
        self.assertIn("/models/gemini-2.5-flash:generateContent", captured["url"])
        self.assertEqual(captured["headers"]["X-goog-api-key"], "test-key")
        self.assertEqual(captured["body"]["contents"][0]["role"], "user")
        self.assertEqual(captured["body"]["contents"][1]["role"], "user")
        self.assertIn("systemInstruction", captured["body"])


if __name__ == "__main__":
    unittest.main()
