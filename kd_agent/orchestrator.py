from __future__ import annotations

from .models import AgentPlan, Capability, PlanStep
from .registry import IntegrationRegistry


class KDOrchestrator:
    """Produces an inspectable plan before any external tool can be invoked."""

    KEYWORDS: tuple[tuple[Capability, tuple[str, ...], str], ...] = (
        (Capability.DOCUMENTS, ("pdf", "document", "dokumen", "file"), "Convert and structure supplied documents."),
        (Capability.WEB_RESEARCH, ("web", "website", "research", "riset", "scrape"), "Collect public web material within configured policy."),
        (Capability.KNOWLEDGE, ("knowledge", "rag", "knowledge base", "basis pengetahuan"), "Query or update the knowledge index."),
        (Capability.MEMORY, ("remember", "memory", "ingat", "memori"), "Retrieve or store approved long-term context."),
        (Capability.TRENDS, ("trend", "trending", "tren"), "Collect and summarize trend signals."),
        (Capability.MEDIA, ("video", "media", "montage"), "Create a media-production plan."),
        (Capability.EXECUTION, ("run", "execute", "deploy", "jalankan"), "Prepare an isolated execution request."),
    )

    def __init__(self, registry: IntegrationRegistry | None = None) -> None:
        self.registry = registry or IntegrationRegistry()

    def plan(self, objective: str) -> AgentPlan:
        if not objective or not objective.strip():
            raise ValueError("Objective cannot be empty.")
        normalized = objective.casefold()
        capabilities = [Capability.PLANNING]
        for capability, keywords, _ in self.KEYWORDS:
            if any(keyword in normalized for keyword in keywords):
                capabilities.append(capability)

        steps: list[PlanStep] = []
        warnings: list[str] = []
        for capability in dict.fromkeys(capabilities):
            action = next((action for cap, _, action in self.KEYWORDS if cap == capability), "Break the objective into verifiable steps.")
            integration = self.registry.configured_for(capability)
            if integration:
                steps.append(PlanStep(capability, action, integration.name))
            else:
                steps.append(PlanStep(capability, action, blocked_by="No configured integration"))
                warnings.append(f"{capability.value}: configure or implement an adapter before execution.")
        return AgentPlan(objective=objective.strip(), steps=steps, warnings=warnings)
