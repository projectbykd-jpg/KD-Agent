# KD Agent

KD Agent is a **modular control plane** for a personal AI agent. It plans work first, shows the integrations needed, and keeps potentially risky execution behind an explicit adapter boundary.

It does not vendor, fork, or silently install the projects listed below. Their licences, release cycles, security posture, and system requirements differ. KD Agent references them as optional upstream integrations; each production integration should be activated only after its licence and credentials have been reviewed.

## First usable milestone

The current baseline provides:

- an integration registry covering all 15 requested projects;
- deterministic task routing and dry-run plans;
- environment-aware readiness reporting;
- a local web control panel for creating and reviewing agent plans;
- a standard-library Python CLI with no runtime dependency or API key required.

```powershell
python -m unittest discover -s tests -v
python -m kd_agent.cli status
python -m kd_agent.cli plan "Riset tren video dari web dan buat knowledge base"
```

## Run the web panel

```powershell
py -m kd_agent.cli serve
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in a browser. The panel is intentionally local-only by default and is a safe planning interface: it creates inspectable plans but will not call third-party services or execute tools yet.

## Architecture

```text
User / API
    -> KD Orchestrator (plan, policy, approval)
        -> Integration Registry
            -> planning | data/RAG | memory | execution | media | learning adapters
```

The orchestrator is deliberately **plan-only** at this stage. That means it cannot scrape, run code, deploy, access a private document, or write a memory entry until a dedicated adapter and approval policy are added.

## Integration catalogue

| Area | Optional upstream projects |
| --- | --- |
| Planning | Hermes Agent, OpenSpec, spec-kit, Fabric |
| Data & RAG | Docling, Scrapling, PageIndex |
| Memory | mem0, headroom, caveman |
| Execution & monitoring | Daytona, TrendRadar |
| Media & learning | hyperframes, OpenMontage, AI Engineering Hub |

Detailed upstream URLs live in `kd_agent/registry.py` so there is one auditable source of truth.

## Configuration

Copy `.env.example` into `.env` only when you enable integrations that need credentials. Keep secrets out of source control. The initial registry marks all integrations as disabled by default, which is intentional: credentials alone must not give the agent permission to take action.

## Next implementation decision

Choose the first end-to-end workflow. A sensible initial slice is **document → knowledge base → cited answer**, built with Docling and PageIndex; another is a **research/trend analyst**, built with Scrapling and TrendRadar. Once chosen, KD Agent can get a concrete API/UI, adapters, persistence, approval screens, and deployment configuration.
