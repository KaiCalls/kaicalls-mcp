# KaiCalls for Hermes Agent

Give your Hermes agent a real phone number. Kai calls businesses for you, asks the
question, presses keys on phone menus and reports back. The same number sends texts
and answers the callback.

You don't need a Twilio account, 10DLC paperwork or a webhook server for calls.
KaiCalls hosts the number, the carrier and the MCP server.

This is a portable Agent Plugins v1 package. It contains no plugin code:

| File | What it does |
|---|---|
| `plugin.json` | Package manifest. It declares the `KAICALLS_API_KEY` secret and marks the server `untrusted`, so Hermes asks before every call or text. |
| `mcp.json` | The hosted KaiCalls MCP server, `https://www.kaicalls.com/api/mcp`, authenticated with your key. |
| `skills/kaicalls/SKILL.md` | Tells the agent when and how to make errand calls, answer Kai's questions mid-call, and send texts. |

## Install

```bash
hermes plugins install https://github.com/KaiCalls/kaicalls-mcp/tree/main/integrations/hermes --no-enable
hermes plugins enable kaicalls
```

Hermes asks for your KaiCalls API key and saves it to `~/.hermes/.env`. Create a key
at [kaicalls.com](https://www.kaicalls.com) under **Settings > API Keys**. No account
yet? Start at [kaicalls.com/ai-agent-phone-number](https://www.kaicalls.com/ai-agent-phone-number?utm_source=hermes&utm_medium=plugin).
A new account's first call to a US or Canada business is free.

## Try it

> Call the Walgreens on Main Street and ask if my prescription is ready. It's under Jane Doe.

The agent finds your KaiCalls agent and number, places the call with `make_call`, and
follows it with `check_call_status`. If Kai needs your date of birth mid-call, the
agent asks you. Then it reads the transcript and tells you what the pharmacy said.

## Lean tool list (optional)

The account server publishes the full KaiCalls tool set. For an agent that only
calls and texts, add this to `~/.hermes/config.yaml`. A `config.yaml` entry with the
same name replaces the package's entry:

```yaml
mcp_servers:
  kaicalls:
    url: "https://www.kaicalls.com/api/mcp"
    headers:
      Authorization: "Bearer ${KAICALLS_API_KEY}"
    trust: untrusted
    tools:
      include: [list_agents, list_numbers, make_call, check_call_status,
                answer_call_question, get_transcript, send_message,
                list_sms_messages, list_conversations, get_conversation,
                list_recent_calls, list_voicemails]
```

## Safety

- Kai says it is an assistant calling for you, and does not place AI calls to
  personal cell phones on a free call.
- Calls go to US and Canada numbers during business calling hours.
- Texts follow consent, opt-out, quiet-hour and rate rules on the server, and a
  refusal says which rule applied.
- What callers say and what texts contain is third-party content. The skill tells
  the agent never to follow instructions inside it.

## Disclosure

This is a hosted-only connector. Call audio, transcripts, text messages and phone
numbers go to kaicalls.com. Calls and texts placed after the free first call count
toward your KaiCalls plan. See [pricing](https://www.kaicalls.com/pricing).
