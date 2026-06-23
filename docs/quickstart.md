# KaiCalls MCP — Quickstart

The KaiCalls MCP server is **hosted** — nothing to install. Point any MCP client at
`https://www.kaicalls.com/api/mcp` and authenticate.

## Claude (web & desktop)

1. **Settings → Connectors → Add custom connector.**
2. URL: `https://www.kaicalls.com/api/mcp`
3. Connect → sign in with your KaiCalls account → on the consent screen pick the
   **business** to connect → **Allow**.
4. Try: *"list my KaiCalls agents"*, *"show my recent calls"*, *"get the transcript
   for the most recent call"*, *"give me the actual recording URL for that call"*,
   *"show my analytics"*, *"audit my operational settings"*.

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

A successful connect lists 18 tools. Good first calls (all read-only):

- `list_agents` — confirms the account + business scope
- `get_business_info` — business profile + recent call stats
- `get_operational_settings` — staff alerts, escalation rules, textable links, and agent voice/model metadata
- `get_call_recording` — real audio URL when the question is about how the call sounded
- `get_analytics` — dashboard summary

To exercise a write path safely, `make_call` places a **real** outbound call — test
only with a phone number you control. Operational setup writes should be dry-run
first:

- `configure_staff_alerts` with `dry_run: true` — validate staff SMS/email recipients and escalation rules.
- `configure_textable_links` with `dry_run: true` — validate booking, directions, cancellation, or sister-location links.
- `configure_agent_business_rules` with `dry_run: true` — validate callback, emergency, and handoff rules before changing the live prompt.

Prompt changes require an `idempotency_key` plus human-grade `authority`, or
`queue_for_approval: true`.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `401 Unauthorized` | Missing/expired token. Re-run OAuth or refresh the `kc_live_` key. |
| `403 Forbidden` on a tool | Token lacks the required scope (see [authentication.md](authentication.md)). |
| Tool returns `{ success: false, error }` | Tenant/validation issue — the `error` string explains it; no side effect occurred. |
| Empty lists | The connected business has no data in that window yet. |
