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
| **Setup endpoint** | `https://www.kaicalls.com/api/mcp/acquisition` (setup-only subset for first-time buyers) |
| **Tools** | 69 on the account endpoint (39 read-only, 30 write/setup); 37 on the setup endpoint |
| **Homepage** | [callmcp.ai](https://callmcp.ai?utm_source=mcp-registry) |
| **Provider** | [KaiCalls](https://www.kaicalls.com) · connor@kaicalls.com |
| **License** | [MIT](LICENSE) (connector definitions and docs) |
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

The account endpoint exposes 69 tools: 39 read-only and 30 write/setup. Every tool carries MCP
safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
The setup endpoint (`/api/mcp/acquisition`) exposes the 37 tools marked ✅ in the
**Setup surface** column, the subset that takes a new business from signup to a working number.
The machine-readable inventory, with full descriptions, scopes and annotations, is in
[`mcp.json`](mcp.json) and [`server-card.json`](server-card.json). In-depth notes for the core
tools are in [`docs/tools.md`](docs/tools.md). The live `tools/list` response returns each tool's
input schema.

### Read-only tools (39)

| Tool | Scope | Setup surface | What it does |
|------|-------|:-------------:|--------------|
| `get_extra_number_status` | `numbers:read` | ✅ | Read an owner-authorized extra-number request. |
| `get_setup_recovery_status` | `numbers:read` | ✅ | Read an owner-authorized setup recovery request by its business and idempotency key. |
| `check_call_status` | `calls:read` |  | Check the status of a call by its ID |
| `list_recent_calls` | `calls:read` |  | List recent calls for the authenticated business |
| `get_transcript` | `calls:read` |  | Get the transcript and summary of a completed call |
| `get_call_recording` | `calls:read` |  | Get the real call recording URL for a call so reviewers can listen to the voice/audio instead of relying only on the transcript. |
| `list_agents` | `agents:read` | ✅ | List the KaiCalls agents on the authenticated account. |
| `get_business_info` | `agents:read` | ✅ | Read back what a business already has: profile details, how many agents are configured, and recent call volume. |
| `get_operational_settings` | `agents:read` | ✅ | Audit the business-level operational setup required before changing a live account: staff alert recipients, SMS/email alert flags, escalation rules, textable send-link entries, and assigned agent voice/model/greeting metadata. |
| `get_activation_status` | `agents:read` | ✅ | Read the persisted proof-first activation status for one accessible business. |
| `list_leads` | `calls:read` |  | List leads for the authenticated business, with optional status/source/agent filters. |
| `get_lead` | `calls:read` |  | Get full details for a single lead by ID, including the latest AI lead score and explanation. |
| `list_voicemails` | `calls:read` |  | List recent voicemails for the authenticated business, including transcripts and recording URLs. |
| `list_sms_messages` | `calls:read` |  | List recent SMS messages for the authenticated business. |
| `list_campaigns` | `calls:read` |  | List outbound call campaigns for the authenticated business. |
| `list_workflow_templates` | `calls:read` |  | List the cadence/campaign workflow templates KaiCalls can run (standard, aggressive, nurture, custom), including each template's retry interval, defaults (call windows, days, attempts), and a ready-to-use cadence_config example. |
| `get_analytics` | `calls:read` |  | Get a dashboard summary (lead counts by status, conversion rate, call volume and duration, top agents, and business outcomes by type) over a recent time window. |
| `get_usage` | `events:read` | ✅ | List recent API usage events (endpoint, method, status code, cost) for the caller's account. |
| `list_plans` | `billing:read` | ✅ | Read the canonical public KaiCalls plan catalog, monthly USD prices and allowances. |
| `get_checkout_status` | `billing:read` | ✅ | Read a Stripe-verified subscription checkout receipt for a business you own. |
| `get_balance` | `billing:read` |  | Get plan terms and usage for accessible businesses. |
| `list_numbers` | `numbers:read` | ✅ | List phone numbers assigned to the accessible business(es), with capability and compliance flags. |
| `get_phone_flow` | `numbers:read` | ✅ | Read how calls ring on the business's hosted phone system: which cells and desk phones ring, for how many seconds, and whether after-hours callers go straight to the AI receptionist. |
| `get_phone_system_status` | `numbers:read` | ✅ | Read whether the business's hosted phone system is set up: Kai's extension, the team ring group and dial plan ids (never secrets), the phone-system line, and `next_step` — the one line to relay to the owner. |
| `list_conversations` | `sms:read` |  | List SMS conversation threads (counterparty timeline metadata) for the authenticated business, most recent first. |
| `get_conversation` | `sms:read` |  | Get a single SMS conversation thread by ID. |
| `get_webhook` | `webhooks:read` |  | List the configured outbound webhook(s) for a business, including supported event types. |
| `list_evals` | `evals:read` |  | List canned mock-conversation eval scenarios for an agent (or all accessible agents). |
| `list_voices` | `agents:read` | ✅ | List the curated, credential-free voice catalog (id, display name, accent, language, gender, sample URL) used to configure agent voices. |
| `search_available_numbers` | `numbers:read` | ✅ | Search the carrier for phone numbers available to purchase (real-time Twilio inventory lookup). |
| `list_knowledge` | `knowledge:read` | ✅ | List agent knowledge base entries for a business. |
| `list_products` | `products:read` |  | List a business's agent product catalog. |
| `list_config_versions` | `agents:read` | ✅ | List an agent's hashed, redacted assistant config version history (rollback lineage included). |
| `get_change_history` | `agents:read` | ✅ | List an agent's recent config-change audit trail (change_type, change_source, old/new value, timestamp) from admin_change_history — the same record the admin_get_change_history voice tool reads over the phone. |
| `list_observability_events` | `events:read` |  | List a business-scoped timeline of compact call-runtime events and redacted integration-delivery attempts. |
| `list_tool_execution_logs` | `events:read` |  | List per-call Vapi tool execution traces from vapi_tool_execution_logs — outcome, latency, timeout, and a redacted result preview for each routed tool call. |
| `list_subscription_history` | `billing:read` |  | List plan/price change history from subscription_change_history — the billing analogue of admin_change_history, written from the Stripe webhook and the right-size apply job. |
| `list_overage_charges` | `billing:read` |  | List the idempotent overage-minutes ledger from billing_overage_charges (legacy per-minute-overage tiers only — 2026 plans carry no overage). |
| `list_rightsize_recommendations` | `billing:read` |  | List per-period auto-right-size decisions from plan_rightsize_recommendations, including the dry_run -> notified -> (kept \| applied \| superseded) lifecycle. |

### Write and setup tools (30)

| Tool | Scope | Setup surface | Hints | What it does |
|------|-------|:-------------:|-------|--------------|
| `request_extra_number` | `billing:write` | ✅ | idempotent · open-world | Reserve an exact pool number and request an owner-only browser review of its recurring extra-line price. |
| `retry_setup` | `numbers:write` | ✅ | destructive · idempotent | Reconcile database pointers for an existing imported signup phone reservation. |
| `make_call` | `calls:write` | ✅ | destructive · open-world | Initiate an outbound voice preview via a KaiCalls AI agent. |
| `configure_staff_alerts` | `agents:write` | ✅ | destructive · idempotent | Save business-owned staff alert recipients and post-call escalation rules. |
| `confirm_notification_destination` | `agents:write` | ✅ | destructive · idempotent | APPROVAL-GATED. Save the owner-approved SMS or email destination for the exact active activation session. |
| `retry_activation_notification` | `agents:write` | ✅ | destructive · idempotent | APPROVAL-GATED. Retry only the current terminal or time-eligible activation notification channel for the exact active session. |
| `choose_customer_route` | `numbers:write` | ✅ | destructive · idempotent | APPROVAL-GATED. After setup proof is complete, save forwarding, published_number, both, or testing. |
| `configure_textable_links` | `agents:write` | ✅ | destructive · idempotent | Create or repair the business_links entries used by the send_link/send_sms tools. |
| `configure_agent_business_rules` | `agents:write` | ✅ | destructive · idempotent · open-world | Safely add or replace a named operational rules section inside an agent inbound prompt, then route the prompt patch through the governed agent.patch broker. |
| `create_campaign` | `calls:write` |  | destructive · open-world | Create an outbound call campaign (cadence + lead batch) and optionally launch it immediately. |
| `upsert_lead` | `leads:write` |  | destructive | Create a new lead or update existing leads for the authenticated business, routed through the governed leads API (business access-checked, usage-logged, and audited). |
| `send_sms` | `sms:write` |  | destructive · open-world | Send an outbound text message from one of your agents' phone lines to a recipient, routed through the governed messaging API. |
| `update_agent_config` | `agents:write` | ✅ | destructive · idempotent · open-world | Edit an agent's live runtime configuration — greeting/first message, inbound or SMS prompt, voice, language model, max call duration, and call-transfer settings — routed through the governed update broker so every change keeps the consent + audit trail (a versioned config snapshot and change history). |
| `request_kaicalls_update` | intent-specific |  | destructive · idempotent · open-world | Ask the KaiCalls on-behalf update broker to perform a scoped, governed mutation. |
| `create_checkout` | `billing:write` | ✅ | idempotent · open-world | Create or resume an owner-bound hosted Stripe checkout for a current plan from list_plans. |
| `update_phone_flow` | `numbers:write` | ✅ | destructive · idempotent | Replace how calls ring on the business's hosted phone system with a full phone flow: { version: 1, hours: { mode: 'always' \| 'business_hours', afterHours: 'kai' }, ring: { members: [{ kind: 'cell', phone: E.164, label, requirePressOne } \| { kind: 'desk_phone' \| 'user', userId, label }], timeoutSeconds: 5-120 }, overflow: 'kai' }. |
| `set_up_phone_system` | `numbers:write` | ✅ | destructive · idempotent · open-world | Turn the business's number into a hosted phone system: Kai is installed as extension 700, the owner's mobile joins a team ring group, and a dial plan rings the team first and hands the call to Kai when nobody picks up. |
| `add_team_phone` | `numbers:write` | ✅ | destructive · idempotent · open-world | Add a teammate's (or the owner's) cell to the phone system's team ring group so it rings before Kai answers. |
| `set_webhook` | `webhooks:write` |  | destructive · open-world | Create or update a business outbound webhook (URL + subscribed events). |
| `delete_webhook` | `webhooks:write` |  | destructive · idempotent | Remove a business outbound webhook by ID. |
| `run_eval` | `evals:write` |  | destructive · open-world | Run a single eval scenario (eval_id) or every scenario for an agent (agent_id) against its live Vapi assistant and grade the result. |
| `create_agent` | `agents:write` | ✅ | open-world | Create a new KaiCalls agent — the secretary that answers this business’s calls (Vapi assistant + KaiCalls records) — with a system prompt, greeting, voice, and model. |
| `attach_number` | `numbers:write` | ✅ | destructive · idempotent · open-world | Assign a phone number already in the KaiCalls registry pool to a business (and optionally route it directly to an agent). |
| `set_owner_phone` | `agents:write` | ✅ | destructive · idempotent | Save the owner's own mobile number on the business record so Kai can ring it first and so activation/forwarding follow-ups can reach a human. |
| `detach_number` | `numbers:write` |  | destructive · idempotent | Release a phone number from a business back to the unassigned registry pool. |
| `buy_number` | `numbers:write` | ✅ | destructive · idempotent · open-world | Request a real phone-number purchase. |
| `upsert_knowledge` | `knowledge:write` | ✅ | destructive | Create a new agent knowledge base entry, or update one when `id` is provided. |
| `upsert_product` | `products:write` |  | destructive | Create a new product row, or update one when `id` is provided. |
| `rollback_config` | `agents:write` | ✅ | destructive · idempotent | Request a rollback to a prior assistant_config_versions snapshot. |
| `report_issue` | `support:write` |  | — | Report a problem with your KaiCalls agent, phone number, billing, or account. |

> **Write-tool safety.** Tools marked destructive change live business configuration
> or reach the outside world: `make_call` places an outbound voice preview, `send_sms`
> sends a real text through opt-out, Do-Not-Call and quiet-hours gates, and
> `create_campaign` can queue outbound calls. `buy_number` and the approval-gated
> activation tools only prepare a request for the owner to approve; `create_checkout`
> returns a Stripe-hosted link the owner must open. Prompt changes route through the
> governed broker, need an idempotency key plus human authority or a queued approval,
> and every outcome is audited.

---

## Configuration

The server is hosted, so the only configuration is authentication. Pick one:

| Setting | Required | How to send it | Notes |
|---------|:--------:|----------------|-------|
| OAuth 2.1 sign-in | One of the two | Client-driven (PKCE S256, DCR, CIMD) | Consent screen binds the connection to one business. |
| KaiCalls API key (`kc_live_...`) | One of the two | `Authorization: Bearer kc_live_...` or `X-KaiCalls-API-Key: kc_live_...` | Generate in the KaiCalls dashboard under **Settings → API Keys**. |

The same choice is declared in [`server.json`](server.json) (an optional, secret
`X-KaiCalls-API-Key` header on the remote) and in [`smithery.yaml`](smithery.yaml)
(an optional `kaicallsApiKey` config field). Leave the key empty to use OAuth.

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

Registry id: `com.kaicalls/kaicalls` (published & active). The registry entry is generated from
[`server.json`](server.json); the Smithery listing from [`smithery.yaml`](smithery.yaml).

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

- **Homepage** — https://callmcp.ai?utm_source=mcp-registry
- **KaiCalls account & dashboard** — https://www.kaicalls.com
- **API docs** — https://www.kaicalls.com/docs/api
- **Privacy** — https://www.kaicalls.com/privacy-policy
- **Terms** — https://www.kaicalls.com/terms-of-service
- **Support** — https://www.kaicalls.com/contact · connor@kaicalls.com

## License

The connector definitions and documentation in this repository are released under
the [MIT License](LICENSE). The KaiCalls service itself is a proprietary hosted
product governed by its [Terms of Service](https://www.kaicalls.com/terms-of-service).
