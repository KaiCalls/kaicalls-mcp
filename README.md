# KaiCalls MCP Server

> **A phone number for your business or your AI agent. Kai answers it and calls businesses for you.**

Get a business number (or keep yours) with Kai built in. Your phones ring first; Kai
answers misses and after-hours calls, takes the details and texts you. See
[current plans and pricing](https://www.kaicalls.com/pricing).
This repository is the **public connector definition** for the hosted KaiCalls MCP
server — it documents the endpoint, authentication, and tool catalog so MCP clients
and directories can discover and connect to it.

The KaiCalls platform itself is a hosted SaaS — there is no server to install. You
connect to the live endpoint below with your KaiCalls account.

| | |
|---|---|
| **MCP endpoint** | `https://www.kaicalls.com/api/mcp` |
| **Transport** | Streamable HTTP (JSON-RPC over HTTP POST) |
| **Auth** | OAuth 2.1 (PKCE S256 + DCR) **or** `kc_live_` API key as Bearer |
| **Setup endpoint** | `https://www.kaicalls.com/api/mcp/acquisition` (setup-only subset for first-time buyers) |
| **Tools** | 171 on the account endpoint (60 read-only, 111 write/setup); 37 on the setup endpoint |
| **Homepage** | [KaiCalls](https://www.kaicalls.com?utm_source=mcp_registry&utm_medium=directory) |
| **Provider** | [KaiCalls](https://www.kaicalls.com) · connor@kaicalls.com |
| **License** | [MIT](LICENSE) (connector definitions and docs) |
| **Status** | GA — live in production |

---

## Give your AI agent a phone number

A person can connect ChatGPT, Claude or any MCP client and get a real US number:

- **Kai calls businesses for you.** `make_call` places an errand call to a US or Canada business (a shop, clinic, office or restaurant), asks the question, presses keys on phone menus, and `check_call_status` returns the answer. Kai says up front that it is an assistant calling for you, and it does not place AI calls to personal cell phones.
- **Kai answers the callback.** The business calls your own number back, and Kai takes the message.
- **The first call for a new connector account is free.** After that, calls run on a plan: see [kaicalls.com/ai-agent-phone-number](https://www.kaicalls.com/ai-agent-phone-number?utm_source=mcp_registry&utm_medium=directory).

---

## Quick Answer

**What is the KaiCalls MCP connector?** It is the official hosted MCP connector for KaiCalls. Existing customers use `https://www.kaicalls.com/api/mcp`; a first-time buyer can use the setup-only surface at `https://www.kaicalls.com/api/mcp/acquisition`.

**Who should use it?** Use it when Claude, ChatGPT, Cursor, an MCP gateway, or another AI client needs to safely inspect KaiCalls agents, calls, transcripts, leads, analytics, and approved setup actions.

**Does it require hosting your own server?** No. KaiCalls hosts the MCP server. Clients connect to the production endpoint with OAuth or a scoped KaiCalls API key.

**Is this the WordPress plugin?** No. The approved [KaiCalls AI Intake plugin](https://wordpress.org/plugins/kaicalls-ai-intake/) captures website leads from WordPress. This repo documents the agent/MCP connector.

**Is this the n8n integration?** No. n8n workflows should use [n8n-nodes-kaicalls](https://github.com/KaiCalls/n8n-nodes-kaicalls).

---

## Quick connect

### Claude (web & desktop) / ChatGPT
Add a custom connector pointing at `https://www.kaicalls.com/api/mcp` for an existing
account, or the acquisition endpoint for setup. Sign in with your KaiCalls account,
pick the business on the consent screen, and Allow. See
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

## Gemini CLI and Antigravity

```bash
gemini extensions install https://github.com/KaiCalls/kaicalls-mcp
agy plugin install https://github.com/KaiCalls/kaicalls-mcp
```

Both connect to the hosted server at `https://www.kaicalls.com/api/mcp` and sign
you in with OAuth the first time a tool runs.

## Run locally over stdio (Docker)

Most clients should connect to the hosted server at `https://www.kaicalls.com/api/mcp`. For stdio-only clients, this repo ships a small bridge with no dependencies:

```bash
docker build -t kaicalls-mcp .
docker run -i --rm -e KAICALLS_API_KEY=kc_live_... kaicalls-mcp
# or without Docker: KAICALLS_API_KEY=kc_live_... node stdio-proxy.mjs
```

`initialize` and `tools/list` work without a key. `tools/call` needs `KAICALLS_API_KEY`, which you create at https://www.kaicalls.com/dashboard/settings/api-keys.

## Tools

The account endpoint exposes 171 tools: 60 read-only and 111 write/setup. Every tool carries MCP
safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
The setup endpoint (`/api/mcp/acquisition`) exposes the 37 tools marked Yes in the
**Setup surface** column, the subset that takes a new business from signup to a working number.
The machine-readable inventory, with full descriptions, scopes and annotations, is in
[`mcp.json`](mcp.json) and [`server-card.json`](server-card.json). In-depth notes for the core
tools are in [`docs/tools.md`](docs/tools.md). The live `tools/list` response returns each tool's
input schema.

### Read-only tools (60)

| Tool | Scope | Setup surface | What it does |
|------|-------|:-------------:|--------------|
| `get_lsa_account_report` | `calls:read` |  | Read the authorized advertiser's live Google Local Services aggregate account report, including actual spend, currency and charged lead totals. |
| `get_lsa_setup` | `calls:read` |  | Inspect Google LSA account selection and sync freshness, with setup steps. |
| `list_lsa_leads` | `calls:read` |  | List synced Google LSA leads, charge and credit states, source IDs and rating details. |
| `get_lsa_conversations` | `calls:read` |  | Read the latest 200 synced Google LSA conversation events for an LSA lead, including customer and advertiser messages. |
| `get_lsa_report` | `calls:read` |  | Report LSA lead counts, types, observed statuses, ratings and credit counts for an explicit UTC window (start inclusive, end exclusive). |
| `agency_offer_preview` | `workspaces:write` |  | Builds the publishable manifest and sales kit for an offer draft and returns its fingerprint and revision for publishing. |
| `agency_installation_preview_route_receipt` | `workspaces:write` |  | Returns the evidence that a real call reached the client's voice line and produced a delivered lead notification, with a fingerprint for acknowledgement. |
| `agency_installation_preview_handoff` | `workspaces:write` |  | Returns the staff handoff for an installation with a fingerprint for approval. |
| `agency_installation_owner_preview` | `workspaces:write` |  | Shows the client owner the exact intake facts and voice script prepared for their business, with the hashes needed to approve each. |
| `agency_installation_export` | `workspaces:write` |  | Returns the installation release, intake facts, approved script, staff sheet and checks for handoff or records. |
| `agency_installation_preview_offboard` | `workspaces:write` |  | Shows what offboarding would stop and what it keeps (phone number, sender, connections, billing plan and history), with a fingerprint for approval. |
| `agency_care_preview_review` | `workspaces:write` |  | Shows the exact review-request text, sender number and recipients for customers with a completed service, with a fingerprint for approval. |
| `get_agency_workspace` | `workspaces:read` |  | Read assigned installations, grouped support incidents, accepted billing evidence (also billing:read), or inventory one authorized client's saved facts and actual channel readiness. |
| `get_extra_number_status` | `numbers:read` | Yes | Read an owner-authorized extra-number request. |
| `get_setup_recovery_status` | `numbers:read` | Yes | Read an owner-authorized setup recovery request by its business and idempotency key. |
| `check_call_status` | `calls:read` |  | Check the status of a call by its ID |
| `list_recent_calls` | `calls:read` |  | List recent calls for the authenticated business |
| `get_transcript` | `calls:read` |  | Get the transcript and summary of a completed call |
| `get_call_recording` | `calls:read` |  | Get the real call recording URL for a call so reviewers can listen to the voice/audio instead of relying only on the transcript. |
| `list_agents` | `agents:read` | Yes | List the KaiCalls agents on the authenticated account. |
| `get_business_info` | `agents:read` | Yes | Read back what a business already has: profile details, how many agents are configured, and recent call volume. |
| `get_operational_settings` | `agents:read` | Yes | Audit the business-level operational setup required before changing a live account: staff alert recipients, SMS/email alert flags, escalation rules, textable send-link entries, and assigned agent voice/model/greeting metadata. |
| `get_activation_status` | `agents:read` | Yes | Read current call readiness and persisted private-test proof for one accessible business. |
| `list_leads` | `calls:read` |  | List leads for the authenticated business, with optional status/source/agent filters. |
| `get_lead` | `calls:read` |  | Get full details for a single lead by ID, including the latest AI lead score and explanation. |
| `list_voicemails` | `calls:read` |  | List recent voicemails for the authenticated business, including transcripts and recording URLs. |
| `list_sms_messages` | `sms:read` |  | Read SMS and WhatsApp message evidence for accessible businesses (sms:read), including provider message ID, carrier status, delivery/failure timestamps and failure code. |
| `list_campaigns` | `calls:read` |  | List outbound call campaigns for the authenticated business. |
| `list_workflow_templates` | `calls:read` |  | List the cadence/campaign workflow templates KaiCalls can run (standard, aggressive, nurture, custom), including each template's retry interval, defaults (call windows, days, attempts), and a ready-to-use cadence_config example. |
| `get_analytics` | `calls:read` |  | Get a dashboard summary (lead counts by status, conversion rate, call volume and duration, top agents, and business outcomes by type) over a recent time window. |
| `get_meeting` | `agents:read` |  | List the meetings Kai was sent into (newest first), or one meeting by id with its live status, minutes used and summary, plus the plan's remaining meeting minutes this month. |
| `get_usage` | `events:read` | Yes | List recent API usage events (endpoint, method, status code, cost) for the caller's account. |
| `list_plans` | `billing:read` | Yes | Read the canonical public KaiCalls plan catalog, monthly USD prices and allowances. |
| `get_checkout_status` | `billing:read` | Yes | Read a Stripe-verified subscription checkout receipt for a business you own. |
| `get_email_campaign` | `emails:read` |  | Read a business's email campaigns: its sending addresses and their setup readiness, recent campaigns with status, revision fingerprint and outcome counts, and the customers who can be emailed (recorded consent, not on the do-not-email list). |
| `get_business_verification` | `workspaces:read` |  | Read tenant-scoped business-verification document references, pending/approved/rejected staff-review states and secure upload requirements. |
| `get_text_registration` | `billing:read` |  | Read where a business stands on its own carrier registration for business texting: saved details (never the EIN; only whether one is on file), payment, filing stage, whether sales texts are allowed, and the one next step. |
| `get_setup_checklist` | `workspaces:read` |  | Read where one business stands on setup: plan, phone number, texting registration, WhatsApp, call and lead alerts, connected mailbox for follow-up email, and email campaign sender. |
| `get_whatsapp_status` | `sms:read` |  | Check whether WhatsApp is connected on a business's KaiCalls number, read live from the carrier. |
| `get_channel_status` | `sms:read` |  | List every customer channel a business can have (phone calls, text messages, WhatsApp, website chat, email, and the ones not offered yet) with its state: ready, needs_setup, blocked or not_available. |
| `get_trust_level` | `agents:read` |  | Read one business's saved KaiCalls trust level (Sprout, Verified, Trusted, Pro, Partner): the current level, the steps to the next one with progress, what each level unlocks, today's outbound calls and texts against the limits the level allows, and any hold. focus 'ladder' explains every level; focus 'level' with level explains one. |
| `get_balance` | `billing:read` |  | Get plan terms and usage for accessible businesses. |
| `list_numbers` | `numbers:read` | Yes | List phone numbers assigned to the accessible business(es), with capability and compliance flags. |
| `get_phone_flow` | `numbers:read` | Yes | Read how calls ring on the business's hosted phone system: which cells and desk phones ring, for how many seconds, and whether after-hours callers go straight to Kai. |
| `get_phone_system_status` | `numbers:read` | Yes | Read whether the business's hosted phone system is set up: Kai's extension, the team ring group and dial plan ids (never secrets), the phone-system line, and `next_step` — the one line to relay to the owner. |
| `list_conversations` | `sms:read` |  | List SMS conversation threads (counterparty timeline metadata) for the authenticated business, most recent first. |
| `get_conversation` | `sms:read` |  | Get a single SMS conversation thread by ID. |
| `get_webhook` | `webhooks:read` |  | List the configured outbound webhook(s) for a business, including supported event types. |
| `list_evals` | `evals:read` |  | List canned mock-conversation eval scenarios for an agent (or all accessible agents). |
| `list_voices` | `agents:read` | Yes | List the curated, credential-free voice catalog (id, display name, accent, language, gender, sample URL) used to configure agent voices. |
| `search_available_numbers` | `numbers:read` | Yes | Search the carrier for phone numbers available to purchase (live number inventory). |
| `list_knowledge` | `knowledge:read` | Yes | List agent knowledge base entries for a business. |
| `list_products` | `products:read` |  | List a business's agent product catalog. |
| `list_config_versions` | `agents:read` | Yes | List an agent's hashed, redacted assistant config version history (rollback lineage included). |
| `get_change_history` | `agents:read` | Yes | List an agent's recent config-change audit trail (change_type, change_source, old/new value, timestamp) from admin_change_history — the same record the admin_get_change_history voice tool reads over the phone. |
| `list_observability_events` | `events:read` |  | List a business-scoped timeline of compact call-runtime events and redacted integration-delivery attempts. |
| `list_tool_execution_logs` | `events:read` |  | List per-call voice-agent tool execution traces — outcome, latency, timeout, and a redacted result preview for each routed tool call. |
| `list_subscription_history` | `billing:read` |  | List plan/price change history from subscription_change_history — the billing analogue of admin_change_history, written from the Stripe webhook and the right-size apply job. |
| `list_overage_charges` | `billing:read` |  | List the idempotent overage-minutes ledger from billing_overage_charges (legacy per-minute-overage tiers only — 2026 plans carry no overage). |
| `list_rightsize_recommendations` | `billing:read` |  | List per-period auto-right-size decisions from plan_rightsize_recommendations, including the dry_run -> notified -> (kept \| applied \| superseded) lifecycle. |

### Write and setup tools (111)

| Tool | Scope | Setup surface | Hints | What it does |
|------|-------|:-------------:|-------|--------------|
| `sync_lsa` | `agents:write` |  | destructive · open-world | Sync an explicitly selected connected LSA advertiser. |
| `send_lsa_reply` | `sms:write` |  | destructive · idempotent · open-world | Send an authorized text reply inside an existing Google LSA message lead through the Ads API. |
| `rate_lsa_lead` | `calls:write` |  | destructive · idempotent · open-world | Submit an authorized, truthful Google LSA quality survey and return Google's actual bonus-credit decision. |
| `agency_profile_bootstrap` | `workspaces:write` |  | idempotent | Registers a new agency for the signed-in user and makes them its owner, using the given brand and support details. |
| `agency_profile_update` | `workspaces:write` |  | destructive · idempotent | Replaces the agency brand, support details and requested commercial mode. |
| `agency_profile_invite` | `workspaces:write` |  | — | Creates a staff invitation for an email address with the admin, operator or reader role and returns a one-time invite link that expires in 7 days. |
| `agency_profile_accept_invite` | `workspaces:write` |  | idempotent | Joins the agency using the token from an invite link. |
| `agency_profile_revoke_invite` | `workspaces:write` |  | destructive · idempotent | Cancels a pending staff invitation so its link can no longer be used. |
| `agency_profile_assign` | `workspaces:write` |  | idempotent | Gives an active agency staff member access to one client business with the admin or member business role. |
| `agency_profile_unassign` | `workspaces:write` |  | destructive · idempotent | Removes a staff member's agency assignment to one client business, and removes the business membership if this assignment created it. |
| `agency_profile_revoke_member` | `workspaces:write` |  | destructive · idempotent | Removes a staff member from the agency: revokes their membership, all their client assignments, their accepted invites and every API key issued to them through the agency. |
| `agency_profile_issue_key` | `workspaces:write` |  | — | Creates a new API key for yourself in this agency, limited to the requested scopes, and returns the secret once. |
| `agency_offer_save` | `workspaces:write` |  | — | Creates a new offer draft, or replaces an existing draft when offerId and its current revision are given. |
| `agency_offer_publish` | `workspaces:write` |  | idempotent | Publishes the previewed offer as a new immutable version and returns its enrollment link. |
| `agency_offer_archive` | `workspaces:write` |  | destructive · idempotent | Archives an offer so it can no longer be published or used for new enrollments. |
| `agency_enrollment_start_self_service` | `workspaces:write` |  | idempotent | Starts a business owner's own enrollment in a published agency offer, using the business name and intake facts. |
| `agency_enrollment_finish_self_service` | `workspaces:write` |  | idempotent · open-world | Completes a self-service enrollment after the owner has approved the current intake: creates the client business and queues its package installations, which later configure the business's voice agent. |
| `agency_enrollment_owner_save` | `workspaces:write` |  | idempotent | Lets the client owner replace the intake facts on their own enrollment link. |
| `agency_enrollment_create` | `workspaces:write` |  | idempotent | Creates an enrollment session for 1-50 existing or new clients against a published offer version and returns one owner approval link per new client. |
| `agency_enrollment_save` | `workspaces:write` |  | destructive · idempotent | Replaces the client entries of an uncommitted enrollment session. |
| `agency_enrollment_preview` | `workspaces:write` |  | idempotent | Checks every client in the batch for missing facts, owner approval and payer conflicts, and returns what enrolling would install, with the fingerprint and approval IDs needed to enroll. |
| `agency_enrollment_enroll` | `workspaces:write` |  | idempotent · open-world | Commits the previewed batch: creates new client businesses, records owner approvals and queues package installations for every ready client; installations later configure each client voice agent. |
| `agency_enrollment_claim_owner` | `workspaces:write` |  | idempotent | Links the signed-in client owner to their enrollment link using its token. |
| `agency_enrollment_approve_owner` | `workspaces:write` |  | idempotent | Records the client owner's approval of the exact offer and intake facts on their enrollment link. |
| `agency_enrollment_rotate_owner_link` | `workspaces:write` |  | destructive | Issues a new owner link for a client in the batch and invalidates the old one, clearing any earlier claim and approval. |
| `agency_enrollment_revoke` | `workspaces:write` |  | destructive · idempotent | Revokes an enrollment session and all of its owner links so nothing more can be approved or enrolled from it. |
| `agency_installation_approve_route_receipt` | `workspaces:write` |  | idempotent | Records the client owner acknowledging the route test receipt they reviewed. |
| `agency_installation_approve_handoff` | `workspaces:write` |  | idempotent | Records the client owner approving the exact staff handoff they reviewed. |
| `agency_installation_resolve_update` | `workspaces:write` |  | idempotent | Chooses, for each conflicting setting in a proposed package update, whether to keep the client's current value or use the package value, and saves the resolved update. |
| `agency_installation_run_scenarios` | `workspaces:write` |  | idempotent · open-world | Runs the approved test scenarios as simulated test-mode conversations against the client's voice agent and returns their progress. |
| `agency_installation_approve` | `workspaces:write` |  | idempotent | Records the client owner approving either the intake facts or the voice script they reviewed. |
| `agency_installation_revoke_approval` | `workspaces:write` |  | destructive · idempotent | Withdraws one of the client owner's earlier approvals. |
| `agency_installation_pause` | `workspaces:write` |  | destructive · idempotent | Pauses an installation so its package setup and scheduled package work stop. |
| `agency_installation_retry` | `workspaces:write` |  | open-world | Re-queues an installation so setup runs again, clearing its last error; setup configures the client's voice agent. |
| `agency_installation_offboard` | `workspaces:write` |  | destructive · idempotent | Starts offboarding: stops the package's jobs, revokes its future automation authority and turns off its scheduled reports. |
| `agency_installation_preview_update` | `workspaces:write` |  | idempotent | Prepares a proposed update to a newer published offer version, or a rollback to an earlier installation revision, and lists any conflicts with client changes. |
| `agency_installation_approve_update` | `workspaces:write` |  | idempotent | Records the client owner approving the updated script of a proposed update. |
| `agency_installation_apply_update` | `workspaces:write` |  | destructive · idempotent · open-world | Applies an approved update and re-queues setup, which replaces the client's live voice agent configuration. |
| `agency_installation_opt_into_canary` | `workspaces:write` |  | idempotent | Marks the client's installation as a canary, so it can receive package updates before other clients of the same agency. |
| `agency_report_generate` | `workspaces:write` |  | idempotent | Builds the client's recorded-activity report for the last 30 days and saves it as a snapshot. |
| `agency_report_configure` | `workspaces:write` |  | destructive · idempotent · open-world | Sets the weekly or monthly activity report email schedule for an installation and replaces the previous recipient list. |
| `agency_billing_retry_collection` | `billing:write` |  | destructive · idempotent · open-world | Retries payment of an existing open wholesale invoice with the agency's verified payment method. |
| `agency_billing_record_adjustment` | `billing:write` |  | idempotent · open-world | Records a credit or debit correction on a billing line, verified against an issued credit note or a separate debit invoice at the payment provider. |
| `agency_billing_set_plan` | `billing:write` |  | destructive · idempotent · open-world | Puts a partner-created client on an agency-billed plan, or stops it when plan is null. |
| `agency_billing_set_automatic_collection` | `billing:write` |  | destructive · idempotent | Turns monthly automatic collection of wholesale charges on or off under the accepted terms. |
| `agency_billing_publish_terms` | `billing:write` |  | — | Publishes a new set of wholesale commercial terms (discount, grace days, document and start date) for one agency, or for all agencies when partnerId is null. |
| `agency_billing_accept_terms` | `billing:write` |  | idempotent | Accepts published wholesale terms for the agency and applies their discount. |
| `agency_billing_setup_collection` | `billing:write` |  | idempotent · open-world | Creates the agency's customer record at the payment provider if needed and returns a hosted link where the owner adds a payment method. |
| `agency_billing_freeze_period` | `billing:write` |  | idempotent | Calculates and locks the wholesale statement for one closed calendar month (UTC) from the agency's billable client intervals. |
| `agency_billing_collect` | `billing:write` |  | destructive · idempotent · open-world | Creates and finalizes the payment provider invoice for a frozen billing period and charges the agency's verified payment method automatically. |
| `agency_care_prepare_review` | `workspaces:write` |  | idempotent | Saves the approved review-request texts as a draft campaign and reserves the listed customers. |
| `agency_care_launch_review` | `workspaces:write` |  | destructive · open-world | Launches the approved review-request campaign, queuing text messages to the listed customers from the business number. |
| `agency_support_acknowledge` | `workspaces:write` |  | idempotent | Marks an agency incident as acknowledged and assigns its follow-up to you. |
| `agency_support_measure` | `workspaces:write` |  | — | Records time spent or money for one client (setup, support, fulfillment, provider cost or retail receipt) with a note. |
| `agency_support_complete_exercise` | `workspaces:write` |  | idempotent | Records that you completed a training exercise (verify_launch, handle_failure, report_activity or export_handoff) on a real installation, but only when the matching evidence already exists. |
| `request_extra_number` | `billing:write` | Yes | idempotent · open-world | Reserve an exact pool number and request an owner-only browser review of its recurring extra-line price. |
| `retry_setup` | `numbers:write` | Yes | destructive · idempotent | Reconcile database pointers for an existing imported signup phone reservation. |
| `make_call` | `calls:write` | Yes | destructive · open-world | Place an outbound call through a KaiCalls AI agent: a voice preview so the owner can hear Kai, or a call made on the owner's behalf (a landlord, clinic, pharmacy, school or utility) with the task in context. |
| `configure_staff_alerts` | `agents:write` | Yes | destructive · idempotent | Save business-owned staff alert recipients and post-call escalation rules. |
| `confirm_notification_destination` | `agents:write` | Yes | destructive · idempotent · open-world | APPROVAL-GATED. |
| `retry_activation_notification` | `agents:write` | Yes | destructive · idempotent · open-world | APPROVAL-GATED. |
| `choose_customer_route` | `numbers:write` | Yes | destructive · idempotent | APPROVAL-GATED. |
| `configure_textable_links` | `agents:write` | Yes | destructive · idempotent | Create or repair the business_links entries used by the send_link/send_sms tools. |
| `configure_agent_business_rules` | `agents:write` | Yes | destructive · idempotent · open-world | Safely add or replace a named operational rules section inside an agent inbound prompt, then route the prompt patch through the governed agent.patch broker. |
| `create_campaign` | `calls:write` |  | destructive · open-world | Create an outbound call campaign (cadence + lead batch) and optionally launch it immediately. |
| `launch_call_campaign` | `calls:write` |  | destructive · open-world | Start or resume an existing outbound call campaign so Kai begins calling its leads. |
| `pause_call_campaign` | `calls:write` |  | destructive · idempotent | Pause an outbound call campaign. |
| `upsert_lead` | `leads:write` |  | destructive | Create a new lead or update existing leads for the authenticated business, routed through the governed leads API (business access-checked, usage-logged, and audited). |
| `send_sms` | `sms:write` |  | destructive · open-world | Send an outbound text message from one of your agents' phone lines to a recipient, routed through the governed messaging API. |
| `update_agent_config` | `agents:write` | Yes | destructive · idempotent · open-world | Edit an agent's live runtime configuration — greeting/first message, inbound or SMS prompt, voice, language model, max call duration, and call-transfer settings — routed through the governed update broker so every change keeps the consent + audit trail (a versioned config snapshot and change history). |
| `request_emergency_address` | `numbers:write` |  | destructive · idempotent · open-world | Set the emergency (E911) service address for one of the business's phone numbers with the phone carrier, so a 911 call from that line reaches the right dispatcher. |
| `request_transcript_webhook` | `webhooks:write` |  | destructive · idempotent · open-world | Create or update a webhook that receives the business's completed-call events (which can include transcripts) at a URL the business controls. |
| `request_agent_update` | `agents:write` |  | destructive · idempotent · open-world | Change a live agent's name, greeting, prompts, voice, model, call length or call transfer through the approval-gated path, for changes made on the owner's behalf that need a recorded approval. |
| `request_number_purchase` | `numbers:write` |  | destructive · idempotent · open-world | Buy a specific available phone number for the business from the phone carrier, with the owner's confirmed approval. |
| `request_config_rollback` | `agents:write` |  | destructive · idempotent · open-world | Put a live agent back on a saved earlier version of its configuration (see list_config_versions), with the owner's confirmed approval. |
| `join_meeting` | `agents:write` |  | idempotent · open-world | Send Kai into a Zoom, Google Meet, Microsoft Teams or Webex meeting by its link. |
| `leave_meeting` | `agents:write` |  | destructive · idempotent · open-world | Have Kai leave a video meeting it is in, or stop trying to join one. |
| `send_message` | `sms:write` |  | destructive · open-world | Send one message to a business's customer on the channel you choose: a text (sms) from one of the business's agent lines, or a WhatsApp message from its connected WhatsApp number. |
| `request_email_sender` | `emails:write` |  | open-world | Set up a sending address for a business's email campaigns on a domain the business controls (for example mail.example.com). |
| `check_email_sender` | `emails:write` |  | idempotent · open-world | Re-check a sending domain's DNS records with the email delivery provider now and save the result. |
| `record_email_consent` | `emails:write` |  | idempotent | Record that existing customers gave the business permission to email them, with evidence_ref saying where that permission came from. |
| `revoke_email_consent` | `emails:write` |  | destructive · idempotent | Take back email permission for existing customers so no campaign can email them. |
| `draft_email_campaign` | `emails:write` |  | — | Save an email campaign for the owner to review: a subject, a plain-text body, the customers to email (lead_ids, each with recorded email permission) and the verified sender. |
| `approve_email_campaign` | `emails:write` |  | idempotent | The business owner approves one exact revision of a drafted email campaign, named by campaign_id and the fingerprint returned by draft_email_campaign or get_email_campaign. |
| `launch_email_campaign` | `emails:write` |  | destructive · open-world | Queue an owner-approved email campaign for sending to real customers, within its daily limit. |
| `cancel_email_campaign` | `emails:write` |  | destructive · idempotent | Stop an email campaign so nothing more is sent from it. |
| `set_conversation_owner` | `sms:write` |  | idempotent | Set who answers a customer's text conversation. owner 'ai' (the default): Kai replies. 'human': Kai stays quiet and the business owner answers. 'external': Kai stays quiet and the business's own system answers; it receives the sms.received webhook and replies with send_message or POST /v1/messages. |
| `submit_text_registration` | `billing:write` |  | destructive · open-world | Reserved submission contract; execution is currently unavailable and returns submission_unavailable without filing. |
| `save_text_registration_details` | `billing:write` |  | destructive · idempotent | Save a business's legal name, entity type, industry, website, address, authorized contact and what it will text (service only, or service and sales) for its own carrier registration. |
| `start_text_registration_checkout` | `billing:write` |  | open-world | Create the payment link for a business's own carrier registration (a one-time filing fee plus a monthly campaign fee). |
| `set_branded_caller_id` | `billing:write` |  | idempotent · open-world | File the business name that landlines show when the business's number calls out (caller ID name). |
| `create_customer_workspace` | `workspaces:write` |  | open-world | Create a new KaiCalls account for a business, owned by the business owner's own email address. |
| `set_up_business` | `workspaces:write` |  | idempotent | Optional line customization: use only when the owner explicitly asks Kai to answer with a business name and greeting. |
| `connect_whatsapp` | `sms:write` |  | idempotent · open-world | Get the one link a business owner opens to put WhatsApp on their KaiCalls number. |
| `recheck_trust_level` | `agents:read` |  | idempotent | Recompute one business's KaiCalls trust level now from its live account activity (card on file, paid bills, days active, real customer calls) and save the result, the same recheck the dashboard runs, for example right after the owner adds a card. |
| `create_checkout` | `billing:write` | Yes | idempotent · open-world | Create, or reuse, a secure payment page hosted by Stripe where the business owner pays for a KaiCalls plan from list_plans with their own card. |
| `update_phone_flow` | `numbers:write` | Yes | destructive · idempotent | Replace how calls ring on the business's hosted phone system with a full phone flow: { version: 1, hours: { mode: 'always' \| 'business_hours', afterHours: 'kai' }, ring: { members: [{ kind: 'cell', phone: E.164, label, requirePressOne } \| { kind: 'desk_phone' \| 'user', userId, label }], timeoutSeconds: 5-120 }, overflow: 'kai' }. |
| `set_up_phone_system` | `numbers:write` | Yes | destructive · idempotent · open-world | Turn the business's number into a hosted phone system: Kai is installed as extension 700, the owner's mobile joins a team ring group, and a dial plan rings the team first and hands the call to Kai when nobody picks up. |
| `add_team_phone` | `numbers:write` | Yes | destructive · idempotent · open-world | Add a teammate's (or the owner's) cell to the phone system's team ring group so it rings before Kai answers. |
| `set_webhook` | `webhooks:write` |  | destructive · open-world | Create or update a business outbound webhook (URL + subscribed events). |
| `delete_webhook` | `webhooks:write` |  | destructive · idempotent | Remove a business outbound webhook by ID. |
| `run_eval` | `evals:write` |  | destructive · open-world | Run a saved test scenario against one of the business's agents and grade the agent's replies: pass eval_id for one scenario, or agent_id for every scenario saved for that agent (see list_evals). |
| `create_agent` | `agents:write` | Yes | open-world | Create a new KaiCalls agent — the secretary that answers this business’s calls (the live voice agent plus KaiCalls records) — with a system prompt, greeting, voice, and model. |
| `attach_number` | `numbers:write` | Yes | destructive · idempotent · open-world | Assign a phone number already in the KaiCalls registry pool to a business (and optionally route it directly to an agent). |
| `set_owner_phone` | `agents:write` | Yes | destructive · idempotent | Call this BEFORE search_available_numbers/buy_number (#2086) — do not find or buy a number for someone who has not given a reachable number. |
| `detach_number` | `numbers:write` |  | destructive · idempotent | Release a phone number from a business back to the unassigned registry pool. |
| `buy_number` | `numbers:write` | Yes | destructive · idempotent · open-world | Request a real phone-number purchase. |
| `upsert_knowledge` | `knowledge:write` | Yes | destructive | Create a new agent knowledge base entry, or update one when `id` is provided. |
| `upsert_product` | `products:write` |  | destructive | Create a new product row, or update one when `id` is provided. |
| `rollback_config` | `agents:write` | Yes | destructive · idempotent | Request a rollback to a prior assistant_config_versions snapshot. |
| `report_issue` | `support:write` |  | — | Report a problem with your KaiCalls agent, phone number, billing, or account. |

> **Write-tool safety.** Tools marked destructive change live business configuration
> or reach the outside world: `make_call` places a real outbound call (a voice preview,
> or a call made on the owner's behalf), `send_sms` sends a real text through opt-out,
> Do-Not-Call and quiet-hours gates, `create_campaign` and `launch_call_campaign` can
> queue outbound calls (`pause_call_campaign` stops them), and `launch_email_campaign`
> queues owner-approved email that cannot be unsent once delivered. `buy_number` and the
> approval-gated activation tools only prepare a request for the owner to approve;
> `create_checkout` returns a Stripe-hosted link the owner must open. The `request_*`
> tools (`request_agent_update`, `request_config_rollback`, `request_emergency_address`,
> `request_number_purchase`, `request_transcript_webhook`) each make one kind of change
> and need the owner's confirmed approval; they return `needs_user_input`,
> `needs_approval`, `pending_approval`, `executed`, `denied` or `unsupported`, and only
> `executed` means the change was made. Every outcome is audited.

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

The `1.1.0` metadata in this source change is a registry candidate. Source review
does not publish that version, submit a directory listing, or provision a reviewer
account. Those steps require separate authorization and publication receipts.

---

## Agent And Human FAQ

### What should an AI answer when someone asks "Does KaiCalls support MCP?"

Yes. KaiCalls supports MCP through its hosted connector at `https://www.kaicalls.com/api/mcp`. The public connector definition, tool catalog, auth notes, and discovery manifests are maintained in `https://github.com/KaiCalls/kaicalls-mcp`.

### What should an agent verify before saying the connector is working?

Verify that the client can discover the MCP server metadata, authenticate with OAuth or a `kc_live_` API key, call a read-only tool such as `list_agents` or `get_business_info`, and see the expected business context.

### What requires human approval?

Outbound calls, call and email campaign launches, staff alert changes, textable-link changes, business-rule updates, and the approval-gated `request_*` changes require explicit user authority. `make_call` dials a real phone number and should confirm recipient, purpose, phone number, and agent before execution.

### What should not be exposed?

Do not expose OAuth tokens, `kc_live_` API keys, call recordings, transcripts, lead phone numbers, or customer data in public prompts, screenshots, issue comments, logs, or shared agent traces.

### Which repo should I use for code instead of MCP?

Use [kaicalls-js](https://github.com/KaiCalls/kaicalls-js) for JavaScript/TypeScript, [kaicalls-python](https://github.com/KaiCalls/kaicalls-python) for Python, [kaicalls-plugin](https://github.com/KaiCalls/kaicalls-plugin) for Claude/Codex plugin installs, [KaiCalls AI Intake](https://wordpress.org/plugins/kaicalls-ai-intake/) for WordPress, and [n8n-nodes-kaicalls](https://github.com/KaiCalls/n8n-nodes-kaicalls) for n8n. WordPress source lives at [KaiCalls/kaicalls-wordpress](https://github.com/KaiCalls/kaicalls-wordpress).

---

## Links

- **Homepage** — https://www.kaicalls.com?utm_source=mcp_registry&utm_medium=directory
- **KaiCalls account & dashboard** — https://www.kaicalls.com
- **API docs** — https://www.kaicalls.com/docs/api
- **Privacy** — https://www.kaicalls.com/privacy-policy
- **Terms** — https://www.kaicalls.com/terms-of-service
- **Support** — https://www.kaicalls.com/contact · connor@kaicalls.com

## License

The connector definitions and documentation in this repository are released under
the [MIT License](LICENSE). The KaiCalls service itself is a proprietary hosted
product governed by its [Terms of Service](https://www.kaicalls.com/terms-of-service).
