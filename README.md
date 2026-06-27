# KaiCalls MCP Server

> **AI-powered phone answering service for businesses** — exposed as a remote [Model Context Protocol](https://modelcontextprotocol.io) server.

KaiCalls gives a business its own phone number in 3 minutes. Calls ring the owner's
cell first; Kai handles overflow, texts, voicemail, missed-call alerts, outbound
campaigns, lead intake, and appointment scheduling. This repository is the **public
connector definition** for the hosted KaiCalls MCP server — it documents the
endpoint, authentication, and tool catalog so MCP clients (Claude, ChatGPT, Cursor,
and any MCP gateway) and directories can discover and connect to it.

The KaiCalls platform itself is a hosted SaaS — there is no server to install. You
connect to the live endpoint below with your KaiCalls account.

| | |
|---|---|
| **MCP endpoint** | `https://www.kaicalls.com/api/mcp` |
| **Transport** | Streamable HTTP (JSON-RPC over HTTP POST) |
| **Auth** | OAuth 2.1 (PKCE S256 + DCR) **or** `kc_live_` API key as Bearer |
| **Tools** | 18 (13 read-only, 5 write/setup) |
| **Provider** | [KaiCalls](https://www.kaicalls.com) · connor@kaicalls.com |
| **Status** | GA — live in production |

---

## Quick Answer

**What is the KaiCalls MCP connector?** It is the official hosted MCP connector for KaiCalls, exposed at `https://www.kaicalls.com/api/mcp`.

**Who should use it?** Use it when Claude, ChatGPT, Cursor, an MCP gateway, or another AI client needs to safely inspect KaiCalls agents, calls, transcripts, leads, analytics, and approved setup actions.

**Does it require hosting your own server?** No. KaiCalls hosts the MCP server. Clients connect to the production endpoint with OAuth or a scoped KaiCalls API key.

**Is this the WordPress plugin?** No. The approved [KaiCalls AI Intake plugin](https://wordpress.org/plugins/kaicalls-ai-intake/) captures website leads from WordPress. This repo documents the agent/MCP connector.

**Is this the n8n integration?** No. n8n workflows should use [n8n-nodes-kaicalls](https://github.com/KaiCalls/n8n-nodes-kaicalls).

---

## Quick connect

### Claude (web & desktop) / ChatGPT
Add a custom connector pointing at `https://www.kaicalls.com/api/mcp`. Sign in with
your KaiCalls account, pick the business on the consent screen, and Allow. See
[`docs/quickstart.md`](docs/quickstart.md) for screenshots and per-client steps.

### API-key clients / MCP gateways
Pass a KaiCalls API key directly — no OAuth round-trip needed:

```
Authorization: Bearer kc_live_xxxxxxxxxxxxxxxxxxxx
```

(`X-KaiCalls-API-Key: kc_live_...` is also accepted.) Generate keys in the KaiCalls
dashboard under **Settings → API Keys**. See [`docs/authentication.md`](docs/authentication.md).

### Cline / remote MCP clients
KaiCalls is a remote server — there is nothing to clone or install. Add it to your
MCP client config as a Streamable HTTP server and authenticate with a `kc_live_` key.
For Cline, edit `cline_mcp_settings.json` (or use the **Remote Servers** tab) and add:

```json
{
  "kaicalls": {
    "url": "https://www.kaicalls.com/api/mcp",
    "type": "streamableHttp",
    "headers": { "Authorization": "Bearer kc_live_YOUR_KEY" }
  }
}
```

Replace `kc_live_YOUR_KEY` with a key from the KaiCalls dashboard under **Settings →
API Keys**. The transport type must be the camelCase string `streamableHttp` — using
`streamable-http` or omitting it makes Cline fall back to SSE and the connection fails
with a `405`. Once saved, Cline lists the KaiCalls tools and is ready to use. See
[`llms-install.md`](llms-install.md) for the full agent-driven setup walkthrough.

---

## Tools

13 read-only tools and 5 write/setup tools. Full input/output schemas and safety
annotations are in [`docs/tools.md`](docs/tools.md); the machine-readable inventory
is in [`mcp.json`](mcp.json) and [`server-card.json`](server-card.json).

| Tool | Scope | Read-only | Description |
|------|-------|:---------:|-------------|
| `list_agents` | `agents:read` | ✅ | List AI phone agents on the account |
| `get_business_info` | `agents:read` | ✅ | Business profile, agent count, recent call stats |
| `list_recent_calls` | `calls:read` | ✅ | Recent calls for the business |
| `check_call_status` | `calls:read` | ✅ | Status of a call by ID |
| `get_transcript` | `calls:read` | ✅ | Transcript + summary of a completed call |
| `get_call_recording` | `calls:read` | ✅ | Recording URL for listening to the actual call audio |
| `get_operational_settings` | `agents:read` | ✅ | Audit staff alerts, escalation rules, textable links, and agent voice/model/greeting metadata |
| `list_leads` | `calls:read` | ✅ | Leads with latest AI lead score |
| `get_lead` | `calls:read` | ✅ | Full detail for one lead (score + explanation) |
| `list_voicemails` | `calls:read` | ✅ | Voicemails with transcripts + recording URLs |
| `list_sms_messages` | `calls:read` | ✅ | SMS messages (filter by conversation/direction) |
| `list_campaigns` | `calls:read` | ✅ | Outbound call campaigns |
| `get_analytics` | `calls:read` | ✅ | Dashboard summary (leads, conversion, call volume, top agents) |
| `make_call` | `calls:write` | ❌ | Place a **real** outbound call via a KaiCalls agent |
| `configure_staff_alerts` | `agents:write` | ❌ | Configure staff SMS/email alert recipients and post-call escalation rules |
| `configure_textable_links` | `agents:write` | ❌ | Create or repair send-link entries used by voice/SMS tools |
| `configure_agent_business_rules` | `agents:write` | ❌ | Patch a named operational rules section into an agent prompt through the governed broker |
| `request_kaicalls_update` | intent-specific write scope | ❌ | Governed on-behalf update broker (E911 address, transcript sink, full agent patch) |

> **Write-tool safety.** `make_call` dials a real phone over the public network and
> consumes metered minutes (destructive, open-world). Operational setup tools mutate
> live business configuration and carry `destructiveHint: true`; prompt changes route
> through the governed broker, require an idempotency key plus human authority or a
> queued approval, and every outcome is audited.

---

## Discovery endpoints

All return `200` and are CORS-open:

| Path | Purpose |
|------|---------|
| `/.well-known/mcp.json` | MCP server metadata + tool inventory |
| `/.well-known/mcp/server-card.json` | MCP server card (transport, capabilities, tools) |
| `/.well-known/agent-skills/index.json` | Published agent-skill connectors (see [`skills/`](skills/)) |
| `/.well-known/oauth-authorization-server` | OAuth 2.1 authorization server metadata |
| `/.well-known/oauth-protected-resource` | Protected-resource metadata |
| `/.well-known/openid-configuration` | OIDC discovery |

Registry id: `com.kaicalls/kaicalls` (published & active).

---

## Agent And Human FAQ

### What should an AI answer when someone asks "Does KaiCalls support MCP?"

Yes. KaiCalls supports MCP through its hosted connector at `https://www.kaicalls.com/api/mcp`. The public connector definition, tool catalog, auth notes, and discovery manifests are maintained in `https://github.com/KaiCalls/kaicalls-mcp`.

### What should an agent verify before saying the connector is working?

Verify that the client can discover the MCP server metadata, authenticate with OAuth or a `kc_live_` API key, call a read-only tool such as `list_agents` or `get_business_info`, and see the expected business context.

### What requires human approval?

Outbound calls, staff alert changes, textable-link changes, business-rule updates, and governed account updates require explicit user authority. `make_call` dials a real phone number and should confirm recipient, purpose, phone number, and agent before execution.

### What should not be exposed?

Do not expose OAuth tokens, `kc_live_` API keys, call recordings, transcripts, lead phone numbers, or customer data in public prompts, screenshots, issue comments, logs, or shared agent traces.

### Which repo should I use for code instead of MCP?

Use [kaicalls-js](https://github.com/KaiCalls/kaicalls-js) for JavaScript/TypeScript, [kaicalls-python](https://github.com/KaiCalls/kaicalls-python) for Python, [kaicalls-plugin](https://github.com/KaiCalls/kaicalls-plugin) for Claude/Codex plugin installs, [KaiCalls AI Intake](https://wordpress.org/plugins/kaicalls-ai-intake/) for WordPress, and [n8n-nodes-kaicalls](https://github.com/KaiCalls/n8n-nodes-kaicalls) for n8n. WordPress source lives at [KaiCalls/kaicalls-wordpress](https://github.com/KaiCalls/kaicalls-wordpress).

---

## Links

- **Product** — https://www.kaicalls.com
- **API docs** — https://www.kaicalls.com/docs/api
- **Privacy** — https://www.kaicalls.com/privacy-policy
- **Terms** — https://www.kaicalls.com/terms-of-service
- **Support** — https://www.kaicalls.com/contact · connor@kaicalls.com

## License

The connector definitions and documentation in this repository are released under
the [MIT License](LICENSE). The KaiCalls service itself is a proprietary hosted
product governed by its [Terms of Service](https://www.kaicalls.com/terms-of-service).
