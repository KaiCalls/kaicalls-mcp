# KaiCalls MCP — Tool Catalog

18 tools. Every surface that advertises the KaiCalls inventory (this repo,
`/.well-known/mcp.json`, the server card, and the live `tools/list`) is derived
from one source of truth, so descriptions and safety annotations never drift.
Full JSON Schemas for inputs/outputs are in [`../mcp.json`](../mcp.json).

**Annotation legend** — `readOnlyHint` (no writes), `destructiveHint` (irreversible
real-world effect), `idempotentHint` (repeat-safe), `openWorldHint` (touches systems
outside the server's own data).

---

## Read tools (13)

### `list_agents` — `agents:read`
List KaiCalls agents available to the authenticated account.
Inputs: `business_id?`, `limit?` (1–100, default 50), `offset?`.
`readOnly · idempotent`

### `get_business_info` — `agents:read`
Business information, agent count, and recent call stats.
Inputs: `business_id?` (defaults to first accessible business).
`readOnly · idempotent`

### `list_recent_calls` — `calls:read`
Recent calls for the authenticated business.
Inputs: `limit?` (1–100, default 20), `offset?`, `agent_id?`, `status?`.
`readOnly · idempotent`

### `check_call_status` — `calls:read`
Status of a call by its ID.
Inputs: `call_id` (required).
`readOnly · idempotent`

### `get_transcript` — `calls:read`
Transcript and summary of a completed call.
Inputs: `call_id` (required).
`readOnly · idempotent`

### `get_call_recording` — `calls:read`
Recording URL for a call so reviewers can listen to the actual call audio instead
of relying only on a transcript.
Inputs: `call_id` (required).
`readOnly · idempotent`

### `get_operational_settings` — `agents:read`
Business-level operational setup: staff alert recipients, SMS/email alert flags,
escalation rules, textable send-link entries, and assigned agent voice/model/greeting
metadata.
Inputs: `business_id?` (defaults to first accessible business).
`readOnly · idempotent`

### `list_leads` — `calls:read`
Leads for the business, with optional `status`/`source`/`agent` filters. Includes
the latest AI lead score when available.
Inputs: `limit?` (1–100, default 50), `offset?`, `status?`, `source?`, `agent_id?`.
`readOnly · idempotent`

### `get_lead` — `calls:read`
Full details for a single lead by ID, including the latest AI lead score and
explanation.
Inputs: `lead_id` (required).
`readOnly · idempotent`

### `list_voicemails` — `calls:read`
Recent voicemails, including transcripts and recording URLs.
Inputs: `limit?` (1–100, default 20), `offset?`.
`readOnly · idempotent`

### `list_sms_messages` — `calls:read`
Recent SMS messages. Filter by conversation or direction (inbound/outbound).
Inputs: `limit?` (1–100, default 50), `offset?`, `conversation_id?`, `direction?`.
`readOnly · idempotent`

### `list_campaigns` — `calls:read`
Outbound call campaigns for the business.
Inputs: `limit?` (1–100, default 25), `offset?`, `status?`.
`readOnly · idempotent`

### `get_analytics` — `calls:read`
Dashboard summary over a recent window: lead counts by status, conversion rate,
call volume and duration, top agents.
Inputs: `days?` (1–90, default 30).
`readOnly · idempotent`

---

## Write/setup tools (5)

### `make_call` — `calls:write`
Initiate a **real** outbound phone call via a KaiCalls AI agent.
Inputs: `agent_id` (required), `to` (required, E.164), `name?`, `context?`,
`first_message?`, `lead_id?`.
`destructive · open-world` — a real phone rings a real person, the agent speaks, and
metered call minutes are consumed. Cannot be recalled. **Test only with numbers you control.**

### `configure_staff_alerts` — `agents:write`
Configure business-owned staff alert recipients and post-call escalation rules.
Use for emergency/urgent texts, callback alerts, billing/provider follow-up alerts,
and ensuring alerts only route to the correct business staff.
Inputs: `business_id?`, `notification_phone?`, `notification_email?`,
`sms_notifications?`, `email_notifications?`, `escalation_rules?`, `dry_run?`.
`destructive · idempotent`

### `configure_textable_links` — `agents:write`
Create or repair `business_links` entries used by the voice/SMS send-link tools.
Use for booking, directions, cancellation, sister-location, or service-specific
links without exposing raw URLs in prompts.
Inputs: `business_id?`, `links` (required), `dry_run?`.
`destructive · idempotent`

### `configure_agent_business_rules` — `agents:write`
Safely add or replace a named operational rules section inside an agent inbound
prompt, then route the prompt patch through the governed `agent.patch` broker.
Use for cross-business handoffs, callback language, alert promises, and
client-specific operating rules without round-tripping the whole prompt manually.
Inputs: `agent_id` (required), `business_id?`, `section_title?`, `rules` (required),
`mode?`, `idempotency_key?`, `actor?`, `authority?`, `dry_run?`,
`queue_for_approval?`, `source_ref?`.
`destructive · idempotent · open-world`

### `request_kaicalls_update` — intent-specific write scope
Governed on-behalf update broker. Supported intents:
- `phone.emergency_address.set` — set an E911 emergency address.
- `transcripts.sink.configure` — configure a transcript webhook sink.
- `agent.patch` — patch agent config (prompt, voice, model, greeting, etc.).

Mutating requests require an `idempotency_key` (repeating a key returns the original
outcome instead of re-running side effects). High-risk changes require human
`authority`. The broker returns one of `needs_user_input`, `needs_approval`,
`pending_approval`, `executed`, `denied`, or `unsupported` — **never an unaudited
side effect**. Supports `dry_run` (validate without executing) and
`queue_for_approval` (create a pending dashboard approval when authority is missing).
`destructive · idempotent · open-world`
