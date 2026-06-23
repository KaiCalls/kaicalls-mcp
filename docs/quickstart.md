# KaiCalls MCP — Quickstart

The KaiCalls MCP server is **hosted** — nothing to install. Point any MCP client at
`https://www.kaicalls.com/api/mcp` and authenticate.

## Claude (web & desktop)

1. **Settings → Connectors → Add custom connector.**
2. URL: `https://www.kaicalls.com/api/mcp`
3. Connect → sign in with your KaiCalls account → on the consent screen pick the
   **business** to connect → **Allow**.
4. Try: *"list my KaiCalls agents"*, *"show my recent calls"*, *"get the transcript
   for the most recent call"*, *"show my analytics"*, *"list my leads"*.

## ChatGPT

1. Add a custom connector / MCP server with URL `https://www.kaicalls.com/api/mcp`.
2. Either complete the OAuth sign-in, **or** provide a `kc_live_` API key as a Bearer
   token directly (no OAuth needed).
3. Same example prompts as above.

## Cursor / other MCP clients

Add a remote (Streamable HTTP) MCP server:

```json
{
  "mcpServers": {
    "kaicalls": {
      "url": "https://www.kaicalls.com/api/mcp",
      "headers": { "Authorization": "Bearer kc_live_xxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

## Verifying the connection

A successful connect lists 13 tools. Good first calls (all read-only):

- `list_agents` — confirms the account + business scope
- `get_business_info` — business profile + recent call stats
- `get_analytics` — dashboard summary

To exercise a write path safely, `make_call` places a **real** outbound call — test
only with a phone number you control.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `401 Unauthorized` | Missing/expired token. Re-run OAuth or refresh the `kc_live_` key. |
| `403 Forbidden` on a tool | Token lacks the required scope (see [authentication.md](authentication.md)). |
| Tool returns `{ success: false, error }` | Tenant/validation issue — the `error` string explains it; no side effect occurred. |
| Empty lists | The connected business has no data in that window yet. |
