# KaiCalls for OpenClaw

Give your OpenClaw agent a real phone number. No Twilio account, no 10DLC paperwork, no
webhook server for calls. Your agent asks Kai, the KaiCalls phone assistant, to call a business
and ask, book or check something; Kai places the call, brings questions back while the call
is live, and reports what happened. The same plugin lets the agent text people, read its
calls and texts, and, through the `kaicalls` channel, answer texts sent to its number.

> **Status:** pending publication on ClawHub. Until then, install from a local build (below).

## Install

```bash
openclaw plugins install clawhub:@kaicalls/kaicalls
```

Requires OpenClaw 2026.11.1 or later. You need a KaiCalls account and an API key:
**Settings → API Keys** at [kaicalls.com](https://www.kaicalls.com/ai-agent-phone-number).

## Configure

Put the key where the Gateway can read it, for example `~/.openclaw/.env`:

```bash
KAICALLS_API_KEY=kc_live_...
```

Then point the plugin config at it and set the agent whose number you use (the agent ID is
the UUID of a KaiCalls agent, shown in the KaiCalls dashboard):

```json5
{
  plugins: {
    entries: {
      kaicalls: {
        enabled: true,
        config: {
          apiKey: { source: "env", provider: "default", id: "KAICALLS_API_KEY" },
          agentId: "22222222-2222-4222-8222-222222222222",
          // businessId: "...",   // only when your key reaches more than one business
          // baseUrl: "https://www.kaicalls.com",
        },
      },
    },
  },
}
```

| Setting | Where | Notes |
|---|---|---|
| `apiKey` | `plugins.entries.kaicalls.config` (or `channels.kaicalls`) | Secret. Falls back to `KAICALLS_API_KEY`. |
| `agentId` | plugin config or channel | KaiCalls agent that calls and texts. |
| `businessId` | plugin config or channel | Optional; needed when the key reaches several businesses. |
| `baseUrl` | plugin config or channel | Default `https://www.kaicalls.com`. |
| `webhookSecret` | `channels.kaicalls` | Secret. Falls back to `KAICALLS_WEBHOOK_SECRET`. |
| `webhookPath` | `channels.kaicalls` | Default `/webhooks/kaicalls`. |
| `dmPolicy` | `channels.kaicalls` | `pairing` (default), `allowlist`, `open`, `disabled`. |
| `allowFrom` | `channels.kaicalls` | E.164 numbers allowed to text the agent; `["*"]` only with `open`. |

## Tools

| Tool | KaiCalls tool | What it does |
|---|---|---|
| `kaicalls_make_call` | `make_call` | Kai calls a US or Canada business for the user. Kai says it is an assistant calling. |
| `kaicalls_call_status` | `check_call_status` | Status, summary, and any `pending_question` Kai is waiting on. |
| `kaicalls_answer_call_question` | `answer_call_question` | Send the user's answer (or decline) to a live call's question. |
| `kaicalls_send_text` | `send_message` | Text (sms) from the agent's line, or WhatsApp from the connected number. |
| `kaicalls_list_texts` | `list_sms_messages` | Recent texts with delivery status. |
| `kaicalls_list_calls` | `list_recent_calls` | Recent calls. |
| `kaicalls_get_transcript` | `get_transcript` | Transcript and summary of a finished call. |
| `kaicalls_list_numbers` | `list_numbers` | Phone numbers on the account. |

Each tool calls the KaiCalls MCP endpoint (`https://www.kaicalls.com/api/mcp`) with your API
key. Consent, Do-Not-Call, calling-hours and rate rules are enforced by KaiCalls, and a refusal
says which rule applied. A new account's first call to a US or Canada business is free.

The bundled `kaicalls` skill teaches the agent the errand-call loop: place the call, poll the
status, relay questions, and report only after the call completed.

## Texts to your agent (the `kaicalls` channel)

Texts (SMS or WhatsApp) sent to the agent's KaiCalls number start an agent turn, and the reply
is texted back from the same number. KaiCalls delivers texts by signed webhook only, so the
Gateway's route must be reachable over public HTTPS.

1. **Expose the webhook path.** For example with Tailscale Funnel, exposing only this path:

   ```bash
   tailscale funnel --bg --set-path /webhooks/kaicalls http://127.0.0.1:18789/webhooks/kaicalls
   ```

   Any HTTPS tunnel or reverse proxy works. Keep the rest of the Gateway private.

2. **Connect.** This tells KaiCalls to send that agent's texts to your Gateway (it calls
   `POST /api/v1/agent-connections`; the key needs `agents:write`, `sms:write` and
   `webhooks:write`):

   ```bash
   openclaw kaicalls connect \
     --webhook-url https://<node>.<tailnet>.ts.net/webhooks/kaicalls \
     --agent-id 22222222-2222-4222-8222-222222222222
   ```

   It prints the webhook signing secret **once**. Add the line it prints to
   `~/.openclaw/.env`:

   ```bash
   KAICALLS_WEBHOOK_SECRET=...
   ```

3. **Enable the channel** and restart the Gateway:

   ```json5
   {
     channels: {
       kaicalls: {
         agentId: "22222222-2222-4222-8222-222222222222",
         dmPolicy: "pairing",
       },
     },
   }
   ```

4. Text the number. With `dmPolicy: "pairing"` an unknown sender gets a pairing code by text;
   approve it with `openclaw pairing approve kaicalls <code>`.

Check or undo the connection:

```bash
openclaw kaicalls status
openclaw kaicalls disconnect   # texts go back to Kai
```

How it behaves:

- Every request is checked against `X-KaiCalls-Signature` (HMAC-SHA256 over the raw body,
  5-minute clock tolerance). Unsigned or stale requests get 401.
- Only inbound `sms.received` events for conversations handed to your agent are turned into
  turns. Other events, and conversations Kai or a person on the team owns, are acknowledged and
  ignored, so the customer never gets two replies.
- The text is third-party content. Texts KaiCalls flags as a likely prompt injection reach the
  agent with a warning.
- Replies go through `POST /api/v1/messages` with an idempotency key, and KaiCalls applies the
  same consent and quiet-hours rules as its own dashboard.
- Attachments are not passed to the agent in this version; the agent is told how many arrived.

### Limits of v1

- Event dedupe is in memory (by `event_id`, 24 hours). A Gateway restart forgets it, so a
  KaiCalls retry that lands after a restart can start a second turn. There is no durable
  journal or catch-up of texts missed while the Gateway was down.
- One account per Gateway (`channels.kaicalls`); no multi-account map yet.

## Build from source

```bash
cd integrations/openclaw
npm install
npm run check        # typecheck, tests, build, manifest check
npm pack --pack-destination /tmp
openclaw plugins install npm-pack:/tmp/kaicalls-kaicalls-0.1.0.tgz --force
openclaw plugins inspect kaicalls --runtime --json
```

`npm install` and the OpenClaw runtime need Node 24.16 or later. `npm run check` also runs on
Node 22: the tests lower the OpenClaw SDK for Node 22 (see `vitest.config.ts`).

`openclaw.plugin.json` is generated from the built schemas: `npm run build && npm run manifest`.

## License

MIT
