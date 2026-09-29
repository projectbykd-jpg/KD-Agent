import json
import os
import unittest
from unittest.mock import patch

from kd_agent.llm import LLMError, chat, default_provider, provider_status


class LLMTests(unittest.TestCase):
    def test_openai_is_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(default_provider(), "openai")

    def test_provider_status_does_not_expose_secrets(self):
        secret = "super-secret"
        with patch.dict(
            os.environ,
            {"OPENAI_API_KEY": secret, "AI_PROVIDER": "openai"},
            clear=True,
        ):
            status = provider_status()
        self.assertTrue(status["providers"][0]["configured"])
        self.assertNotIn(secret, json.dumps(status))

    def test_missing_key_is_reported(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "openai"}, clear=True):
            with self.assertRaises(LLMError):
                chat("hello")

    def test_invalid_provider_is_rejected(self):
        with patch.dict(
            os.environ,
            {"AI_PROVIDER": "invalid", "OPENAI_API_KEY": "x"},
            clear=True,
        ):
            self.assertEqual(default_provider(), "openai")


if __name__ == "__main__":
    unittest.main()
