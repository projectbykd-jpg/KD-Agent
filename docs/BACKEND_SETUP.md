# KD Agent backend setup

GitHub Pages hosts the public frontend. It does not store provider secrets. Deploy the Python API as a Render Blueprint, then connect the generated backend URL from the panel's **Backend URL** field.

## Deploy

1. Sign in to Render.
2. Create **New → Blueprint** and select `projectbykd-jpg/KD-Agent`.
3. Render reads `render.yaml`, deploys `kd-agent-api`, and waits for `/api/v1/health`.
4. In Render → **Environment**, add the provider secrets. Use the names below; never commit the secret values to Git.
5. Copy the generated `https://…onrender.com` API URL and paste it into the panel's **Backend URL** field.

## AI provider configuration

OpenAI is the default provider:

    AI_PROVIDER=openai
    OPENAI_API_KEY=your-openai-secret
    OPENAI_MODEL=gpt-5.6

Add Groq:

    GROQ_API_KEY=your-groq-secret
    GROQ_MODEL=openai/gpt-oss-120b

Add OpenRouter:

    OPENROUTER_API_KEY=your-openrouter-secret
    OPENROUTER_MODEL=openrouter/auto

You can switch the provider in the top-right selector. The panel calls `/api/v1/providers` to show whether each provider is configured. Secret values are never returned by that endpoint.

## API endpoints

    GET  /api/v1/health
    GET  /api/v1/providers
    GET  /api/v1/integrations
    POST /api/v1/plan
    POST /api/v1/chat

`POST /api/v1/chat` accepts:

    {
      "provider": "openai",
      "model": "gpt-5.6",
      "prompt": "Bantu saya merancang fitur ini.",
      "history": []
    }

The backend sends the provider request server-side, so browser code never sees the API key.

## Connector activation

The repository's other integrations remain disabled by default. Enable one only after its upstream software, licence, credentials, and runtime have been reviewed.

## Architecture

    GitHub Pages UI
          |
          | HTTPS
          v
    KD Agent API (Render)
          |
          +--> OpenAI
          +--> Groq
          +--> OpenRouter
          |
          +--> Optional integration adapters

The LLM provider layer generates text and plans, while external actions remain behind explicit adapters and approval boundaries.
