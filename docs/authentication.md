# KaiCalls MCP — Authentication

The KaiCalls MCP server accepts **two** auth mechanisms. Interactive MCP clients
(Claude, ChatGPT) use OAuth; programmatic clients and gateways use an API key.

## 1. OAuth 2.1 (interactive clients)

Full OAuth 2.1: authorization code + **PKCE (S256)**, refresh tokens, and
**Dynamic Client Registration** (RFC 7591) so clients self-register without a manual
app setup. Client ID Metadata Documents (CIMD) are supported.

Discovery (all return `200`):

| Endpoint | |
|---|---|
| `https://www.kaicalls.com/.well-known/oauth-authorization-server` | Authorization-server metadata |
| `https://www.kaicalls.com/.well-known/oauth-protected-resource` | Protected-resource metadata |
| `https://www.kaicalls.com/.well-known/openid-configuration` | OIDC discovery |

**Flow:** the client discovers the endpoints → registers (DCR) → redirects the user
to authorize → the user signs in and, on the KaiCalls consent screen, **selects which
business** the connection is scoped to → the client exchanges the code (with PKCE
verifier) for tokens. The access token is bound to a single business; all tool calls
are RLS-enforced to that business.

## 2. API key (programmatic clients & MCP gateways)

Pass a KaiCalls API key as a Bearer token — no OAuth round-trip:

```
Authorization: Bearer kc_live_xxxxxxxxxxxxxxxxxxxx
```

`X-KaiCalls-API-Key: kc_live_...` is also accepted. Generate and scope keys in the
KaiCalls dashboard under **Settings → API Keys**.

## Scopes

| Scope | Grants |
|-------|--------|
| `agents:read` | `list_agents`, `get_business_info`, `get_operational_settings`, `get_trust_level`, `recheck_trust_level`, config history |
| `calls:read` | call/lead/voicemail/campaign reads, `get_call_recording`, `get_analytics`, Google Local Services reads |
| `sms:read` | `list_sms_messages`, conversations, WhatsApp and channel status |
| `calls:write` | `make_call`, `create_campaign`, `launch_call_campaign`, `pause_call_campaign` |
| `agents:write` | operational setup tools (`configure_staff_alerts`, `configure_textable_links`, `configure_agent_business_rules`), `request_agent_update`, `request_config_rollback` |
| `numbers:write` | number setup tools, `request_emergency_address`, `request_number_purchase` |
| `webhooks:write` | `set_webhook`, `delete_webhook`, `request_transcript_webhook` |
| `emails:read`, `emails:write` | `get_email_campaign`; the email sender, consent and campaign tools (`request_email_sender` through `cancel_email_campaign`) |
| `workspaces:read`, `workspaces:write` | the setup checklist, business verification, customer workspaces, `get_agency_workspace` and the `agency_*` tools (the `agency_billing_*` tools use `billing:write` instead) |

The exact scope of every tool is listed in [`../mcp.json`](../mcp.json) and the
[README](../README.md#tools).

A key only ever sees data for the business it is scoped to. Reads are bounded to that
tenant (closed-world). Write/setup tools mutate live account configuration or place
real calls, so grant write scopes only to trusted clients.
