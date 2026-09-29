import unittest

from kd_agent.models import Capability
from kd_agent.orchestrator import KDOrchestrator


class OrchestratorTests(unittest.TestCase):
    def test_plan_always_begins_with_planning(self):
        plan = KDOrchestrator().plan("Riset tren video dari web")
        self.assertEqual(plan.steps[0].capability, Capability.PLANNING)

    def test_plan_selects_relevant_capabilities(self):
        plan = KDOrchestrator().plan("Convert a PDF and update the RAG knowledge base")
        capabilities = {step.capability for step in plan.steps}
        self.assertTrue({Capability.DOCUMENTS, Capability.KNOWLEDGE}.issubset(capabilities))

    def test_empty_objective_is_rejected(self):
        with self.assertRaises(ValueError):
            KDOrchestrator().plan("  ")
