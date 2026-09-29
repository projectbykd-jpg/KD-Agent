from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class Capability(str, Enum):
    PLANNING = "planning"
    DOCUMENTS = "documents"
    WEB_RESEARCH = "web_research"
    KNOWLEDGE = "knowledge"
    MEMORY = "memory"
    EXECUTION = "execution"
    TRENDS = "trends"
    MEDIA = "media"
    LEARNING = "learning"


@dataclass(frozen=True)
class Integration:
    name: str
    repository: str
    capability: Capability
    enabled: bool = False
    required_environment: tuple[str, ...] = ()
    note: str = ""


@dataclass
class PlanStep:
    capability: Capability
    action: str
    integration: str | None = None
    blocked_by: str | None = None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["capability"] = self.capability.value
        return data


@dataclass
class AgentPlan:
    objective: str
    steps: list[PlanStep] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "objective": self.objective,
            "steps": [step.to_dict() for step in self.steps],
            "warnings": self.warnings,
        }
