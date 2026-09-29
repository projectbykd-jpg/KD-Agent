import os
import unittest
from unittest.mock import patch

from kd_agent.models import Capability, Integration
from kd_agent.registry import IntegrationRegistry


class RegistryTests(unittest.TestCase):
    def test_connector_requires_explicit_enablement(self):
        integration = Integration("Test Tool", "https://example.com", Capability.PLANNING)
        registry = IntegrationRegistry([integration])
        self.assertIsNone(registry.configured_for(Capability.PLANNING))
        with patch.dict(os.environ, {"KD_AGENT_ENABLE_TEST_TOOL": "true"}, clear=False):
            self.assertEqual(registry.configured_for(Capability.PLANNING), integration)

    def test_status_never_includes_environment_values(self):
        integration = Integration("Safe Tool", "https://example.com", Capability.MEMORY, required_environment=("PRIVATE_KEY",))
        with patch.dict(os.environ, {"PRIVATE_KEY": "not-for-output"}, clear=False):
            status = IntegrationRegistry([integration]).status()["memory"][0]
        self.assertNotIn("not-for-output", str(status))
        self.assertEqual(status["missing_environment"], [])
