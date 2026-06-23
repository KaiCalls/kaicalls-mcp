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
| `agents:read` | `list_agents`, `get_business_info`, `get_operational_settings` |
| `calls:read` | call/lead/voicemail/SMS/campaign reads, `get_call_recording`, `get_analytics` |
| `calls:write` | `make_call` |
| `agents:write` | operational setup tools (`configure_staff_alerts`, `configure_textable_links`, `configure_agent_business_rules`) and `request_kaicalls_update` agent intents |
| `numbers:write`, `webhooks:write` | `request_kaicalls_update` for E911 and transcript webhook intents |

A key only ever sees data for the business it is scoped to. Reads are bounded to that
tenant (closed-world). Write/setup tools mutate live account configuration or place
real calls, so grant write scopes only to trusted clients.
