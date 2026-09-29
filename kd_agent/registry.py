from __future__ import annotations

import os
from collections import defaultdict

from .models import Capability, Integration


class IntegrationRegistry:
    """Describes upstream projects without importing or redistributing them."""

    def __init__(self, integrations: list[Integration] | None = None) -> None:
        self._integrations = integrations or DEFAULT_INTEGRATIONS

    def all(self) -> list[Integration]:
        return list(self._integrations)

    def for_capability(self, capability: Capability) -> list[Integration]:
        return [item for item in self._integrations if item.capability == capability]

    def configured_for(self, capability: Capability) -> Integration | None:
        for item in self.for_capability(capability):
            if self._is_enabled(item) and all(os.getenv(key) for key in item.required_environment):
                return item
        return None

    @staticmethod
    def _is_enabled(item: Integration) -> bool:
        """Enable connectors only through an explicit environment setting."""
        key = "KD_AGENT_ENABLE_" + "".join(
            character if character.isalnum() else "_" for character in item.name.upper()
        )
        return item.enabled or os.getenv(key, "").casefold() in {"1", "true", "yes"}

    def status(self) -> dict[str, list[dict[str, object]]]:
        result: dict[str, list[dict[str, object]]] = defaultdict(list)
        for item in self._integrations:
            missing = [key for key in item.required_environment if not os.getenv(key)]
            enabled = self._is_enabled(item)
            result[item.capability.value].append(
                {
                    "name": item.name,
                    "repository": item.repository,
                    "enabled": enabled,
                    "ready": enabled and not missing,
                    "missing_environment": missing,
                    "enable_variable": "KD_AGENT_ENABLE_" + "".join(
                        character if character.isalnum() else "_" for character in item.name.upper()
                    ),
                    "note": item.note,
                }
            )
        return dict(result)


def _integration(name: str, url: str, capability: Capability, *, enabled: bool = False,
                 env: tuple[str, ...] = (), note: str = "") -> Integration:
    return Integration(name, url, capability, enabled, env, note)


DEFAULT_INTEGRATIONS = [
    _integration("Hermes Agent", "https://github.com/NousResearch/hermes-agent", Capability.PLANNING),
    _integration("OpenSpec", "https://github.com/Fission-AI/OpenSpec", Capability.PLANNING),
    _integration("spec-kit", "https://github.com/github/spec-kit", Capability.PLANNING),
    _integration("Docling", "https://github.com/docling-project/docling", Capability.DOCUMENTS),
    _integration("Scrapling", "https://github.com/D4Vinci/Scrapling", Capability.WEB_RESEARCH),
    _integration("PageIndex", "https://github.com/VectifyAI/PageIndex", Capability.KNOWLEDGE),
    _integration("mem0", "https://github.com/mem0ai/mem0", Capability.MEMORY, env=("MEM0_API_KEY",)),
    _integration("headroom", "https://github.com/headroomlabs-ai/headroom", Capability.MEMORY),
    _integration("caveman", "https://github.com/JuliusBrussee/caveman", Capability.MEMORY),
    _integration("Fabric", "https://github.com/danielmiessler/Fabric", Capability.PLANNING),
    _integration("Daytona", "https://github.com/daytonaio/daytona", Capability.EXECUTION, env=("DAYTONA_API_KEY",)),
    _integration("TrendRadar", "https://github.com/sansan0/TrendRadar", Capability.TRENDS),
    _integration("hyperframes", "https://github.com/heygen-com/hyperframes", Capability.MEDIA),
    _integration("OpenMontage", "https://github.com/calesthio/OpenMontage", Capability.MEDIA),
    _integration("AI Engineering Hub", "https://github.com/patchy631/ai-engineering-hub", Capability.LEARNING),
]
