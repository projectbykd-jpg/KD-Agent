# KD Agent backend setup

GitHub Pages hosts the public planning panel. It does not host private credentials or run the AI/data integrations. Deploy this repository as a Render Blueprint to run the KD Agent API.

## Deploy

1. Sign in to [Render](https://render.com/).
2. Create **New** → **Blueprint** and select `projectbykd-jpg/KD-Agent`.
3. Render reads `render.yaml`, deploys `kd-agent-api`, and waits for `/api/v1/health` to return `ok`.
4. Copy the generated `https://…onrender.com` API URL. It will be used by the public panel once authentication and execution endpoints are enabled.

## Connector activation

All connectors are disabled by default. Enable one only after its upstream software, licence, credentials, and runtime have been reviewed. In Render, add the matching environment variable:

```text
KD_AGENT_ENABLE_DOCLING=true
KD_AGENT_ENABLE_SCRAPLING=true
KD_AGENT_ENABLE_PAGEINDEX=true
KD_AGENT_ENABLE_MEM0=true
MEM0_API_KEY=...
KD_AGENT_ENABLE_DAYTONA=true
DAYTONA_API_KEY=...
```

The API exposes readiness at `/api/v1/integrations`; it never returns secret values. Enabling a connector records intent and readiness only. A production execution adapter must still be implemented, tested, and approved before it can process a user task.

## Architecture by component

| Integration | KD Agent role | Deployment requirement |
| --- | --- | --- |
| Hermes Agent | optional multi-platform agent gateway | separate Hermes runtime + model provider |
| OpenSpec / spec-kit | development specifications | developer-tool workflow |
| Docling | document conversion | Python service/runtime |
| Scrapling | web research | policy-controlled scraper runtime |
| PageIndex | structured retrieval | index storage + Python runtime |
| mem0 | durable memory | mem0 service/API key |
| headroom / caveman | context/token optimization | local tool adapter |
| Fabric | prompt patterns | local tool adapter |
| Daytona | isolated execution | Daytona account/API key |
| TrendRadar | trend signals | upstream runtime/data source |
| hyperframes / OpenMontage | media pipeline | Node/media runtime and provider configuration |
| AI Engineering Hub | reference learning material | curated source, no runtime API |
