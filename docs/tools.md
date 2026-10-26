# KaiCalls MCP — Tool Catalog

The account endpoint exposes 171 tools (60 read-only, 111 write/setup). This page
covers the 22 core call, lead and operational-setup tools in depth. The full list of
all 171 tools, with scope, safety hints and a one-line description, is in the
[README](../README.md#tools). Every surface that advertises the KaiCalls inventory
(this repo, `/.well-known/mcp.json`, the server card, and the live `tools/list`) is
derived from one source of truth, so descriptions and safety annotations never drift.
Descriptions, scopes, annotations and output schemas are in [`../mcp.json`](../mcp.json);
the live `tools/list` response returns each tool's input schema.

**Annotation legend** — `readOnlyHint` (no writes), `destructiveHint` (irreversible
real-world effect), `idempotentHint` (repeat-safe), `openWorldHint` (touches systems
outside the server's own data).

---

## Core read tools (13)

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

### `list_sms_messages` — `sms:read`
SMS and WhatsApp message evidence: provider message ID, carrier status,
delivery/failure timestamps and failure code. Filter by business, conversation or
direction (inbound/outbound). Provider acceptance is not delivery; use `delivered_at`
and carrier status as evidence.
Inputs: `limit?`, `offset?`, `business_id?`, `conversation_id?`, `direction?`.
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

## Core write/setup tools (9)

### `make_call` — `calls:write`
Place a **real** outbound phone call through a KaiCalls agent: a voice preview so the
owner can hear Kai, or a call made on the owner's behalf with the task in context.
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

### Approval-gated changes — `request_*`
Five tools make one kind of governed change each, on the owner's behalf. They replace
the former single multi-intent update tool.

| Tool | Scope | What it changes | Required inputs |
|------|-------|-----------------|-----------------|
| `request_emergency_address` | `numbers:write` | The emergency (E911) service address for one of the business's numbers, with the phone carrier. Replaces any address on file. | `phone_number`, `address`, `disclosure_acknowledged` (true after the owner reads the 911 notice), `idempotency_key` |
| `request_transcript_webhook` | `webhooks:write` | Creates or updates a webhook that receives completed-call events (which can include transcripts) at a URL the business controls. A new webhook's signing secret is returned once. | `webhook_url`, `idempotency_key` |
| `request_agent_update` | `agents:write` | A live agent's name, greeting, prompts, voice, model, call length or call transfer. For a direct edit by the owner, prefer `update_agent_config`. | `agent_id`, at least one field to change, `idempotency_key` |
| `request_number_purchase` | `numbers:write` | Buys a specific available number (find one with `search_available_numbers`); the carrier bills it right away. Optionally connects it to `agent_id`. | `phone_number`, `idempotency_key` |
| `request_config_rollback` | `agents:write` | Puts a live agent back on a saved earlier configuration (see `list_config_versions`). | `agent_id`, `version_number` or `version_id`, `idempotency_key` |

Shared rules:
- `idempotency_key` is required to make the change; repeating a key returns the first
  outcome instead of running the change again.
- The owner's confirmed approval goes in `authority`
  (`{ mode: 'human_confirmed', confirmed_by, confirmed_at, confirmation_ref }`).
  Without it the result is `needs_approval` and nothing changes.
- `dry_run: true` checks access, inputs and approval without making the change;
  `queue_for_approval: true` creates a pending approval the owner can accept in the
  dashboard instead of returning `needs_approval`. `reason` is kept in the audit log.
- Each returns `needs_user_input`, `needs_approval`, `pending_approval`, `executed`,
  `denied` or `unsupported`. Only `executed` means the change was made — **never an
  unaudited side effect**.

`destructive · idempotent · open-world`
