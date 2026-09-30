# KD Agent backend setup

GitHub Pages or the Render static panel hosts the public frontend. It does not store provider secrets. Deploy the Python API as a Render Blueprint and keep provider credentials in Render Environment.

## Deploy

1. Sign in to Render.
2. Create **New → Blueprint** and select `projectbykd-jpg/KD-Agent`.
3. Render reads `render.yaml`, deploys `kd-agent-api`, and waits for `/api/v1/health`.
4. In Render → **Environment**, add the provider secret. Never commit the secret value to Git.
5. The panel uses the backend URL internally; there is no public Backend URL input.

## AI provider configuration

Gemini is the primary provider:

    AI_PROVIDER=gemini
    GEMINI_API_KEY=your-gemini-secret
    GEMINI_MODEL=gemini-2.5-flash

Groq remains available:

    GROQ_API_KEY=your-groq-secret
    GROQ_MODEL=openai/gpt-oss-120b

The panel calls `/api/v1/providers` to show whether each provider is configured. Secret values are never returned by that endpoint.

## API endpoints

    GET  /api/v1/health
    GET  /api/v1/providers
    GET  /api/v1/integrations
    POST /api/v1/plan
    POST /api/v1/chat

`POST /api/v1/chat` accepts:

    {
      "provider": "gemini",
      "model": "gemini-2.5-flash",
      "prompt": "Bantu saya merancang fitur ini.",
      "history": []
    }

The backend sends provider requests server-side, so browser code never sees the API key.

## Provider architecture

    Public panel
          |
          | HTTPS
          v
    KD Agent API (Render)
          |
          +--> Google Gemini (primary)
          +--> Groq (optional)
          |
          +--> Optional integration adapters

The LLM provider layer generates text and plans, while external actions remain behind explicit adapters and approval boundaries.
