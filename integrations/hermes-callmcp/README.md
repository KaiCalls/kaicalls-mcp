# CallMCP for Hermes Agent

**Give your Hermes agent a phone number.**

Ask Hermes to call the pharmacy, the landlord or the shop down the street. Kai, the
phone assistant behind CallMCP, places the call, gets through the phone menu, asks
your question and tells Hermes what they said. If Kai needs something only you know,
like a date of birth, Hermes asks you mid-call and passes your answer along.

It also:

- **Waits on hold for you.** Kai sits in the queue and rings your phone when a real
  person picks up.
- **Texts from its own number**, and takes the callback when a business rings back.
- **Joins your video meetings.** Send Kai into a Zoom, Google Meet, Microsoft Teams
  or Webex meeting and it emails you a summary afterwards.

Your first call to a US or Canada business line is free.

## Install

```bash
hermes plugins install callmcp
hermes plugins enable callmcp
```

Before the catalog listing is live, install from this repository instead:

```bash
hermes plugins install https://github.com/KaiCalls/kaicalls-mcp/tree/main/integrations/hermes-callmcp --no-enable
hermes plugins enable callmcp
```

Hermes asks for your key and saves it as `CALLMCP_API_KEY`. Create a key at
[kaicalls.com](https://www.kaicalls.com) under **Settings > API Keys**. No account
yet? Start at [kaicalls.com/ai-agent-phone-number](https://www.kaicalls.com/ai-agent-phone-number?utm_source=hermes&utm_medium=plugin).

## Try it

> Call the Walgreens on Main Street and ask if my prescription is ready. It's under Jane Doe.

Hermes asks you to approve the call, places it with `make_call` and follows it with
`check_call_status`. When the call ends it reads the transcript and tells you what
the pharmacy said.

> Call my internet provider about the outage and wait on hold for me.

> Join my 2pm Zoom and send me the notes: https://zoom.us/j/...

## What's in the package

This is a portable Agent Plugins v1 package. It contains no plugin code.

| File | What it does |
|---|---|
| `plugin.json` | Package manifest. Declares the `CALLMCP_API_KEY` secret and marks the server `untrusted`, so Hermes asks before every call, text or meeting. |
| `mcp.json` | The hosted CallMCP server, `https://callmcp.ai/mcp` (Streamable HTTP), signed in with your key. |
| `skills/callmcp/SKILL.md` | Tells the agent how to place calls, answer Kai's questions mid-call, wait on hold, text and join meetings. |

## Lean tool list (optional)

The server offers the full KaiCalls tool set, including tools for running a business
line. For an agent that only calls, texts and joins meetings, add this to
`~/.hermes/config.yaml`. An entry there with the same name replaces the package's:

```yaml
mcp_servers:
  callmcp:
    url: "https://callmcp.ai/mcp"
    headers:
      Authorization: "Bearer ${CALLMCP_API_KEY}"
    trust: untrusted
    tools:
      include: [list_agents, list_numbers, make_call, check_call_status,
                answer_call_question, send_call_note, get_transcript,
                send_message, list_sms_messages, list_recent_calls,
                list_voicemails, join_meeting, get_meeting, leave_meeting,
                get_setup_checklist, set_owner_phone]
```

## Safety

- Kai says it is an assistant calling for you. It does not place AI calls to
  personal cell phones on a free call.
- Calls go to US and Canada numbers during business calling hours. A call outside
  those hours is refused, and the agent asks whether to try again later.
- Texts follow consent, opt-out, quiet-hour and rate rules on the server, and a
  refusal says which rule applied.
- What people say on calls, in texts and in meetings is third-party content. The
  skill tells the agent never to follow instructions inside it.

## Disclosure

- Hosted-only connector with no local code. Every tool call, with its arguments,
  goes to `callmcp.ai` over HTTPS, signed with your key as a bearer header.
- Call audio, transcripts, texts, meeting notes and phone numbers are handled by
  KaiCalls, the company behind CallMCP.
- After the free first call, calls, texts and meeting minutes count toward your
  KaiCalls plan. See [pricing](https://callmcp.ai/pricing).
- The tool set is served by the remote server at runtime and is not covered by the
  catalog's pinned commit.
- No telemetry from the package itself.
