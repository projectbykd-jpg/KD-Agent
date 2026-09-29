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

If the `py` launcher is not available on Windows, use the installed Python executable directly:

```powershell
& "C:\Users\lacos\AppData\Local\Programs\Python\Python313\python.exe" -m kd_agent.cli serve
```

## Public GitHub Pages panel

The repository publishes a static, privacy-preserving planning panel to GitHub Pages through `.github/workflows/deploy-pages.yml`. After the deployment workflow completes, it is available at:

`https://projectbykd-jpg.github.io/KD-Agent/`

The public panel includes active links for all 15 upstream projects and can make plans locally in the browser. GitHub Pages cannot securely host API keys or run Python adapters, so it is not the execution backend. The production architecture is:

```text
GitHub Pages (public UI) -> authenticated API/backend -> approved integration adapters -> upstream services
```

Every upstream project is catalogued and routed by capability. Before an adapter is enabled in production, review its licence, deployment requirements, and credentials; the page itself never treats a repository link as an installed or authorized integration.

## Deploy the private backend

`render.yaml` deploys the API as a Render Blueprint. The backend keeps credentials off GitHub Pages and exposes health/readiness endpoints:

```text
GET /api/v1/health
GET /api/v1/integrations
POST /api/v1/plan
```

Use [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md) for the deployment and connector-activation guide.

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
