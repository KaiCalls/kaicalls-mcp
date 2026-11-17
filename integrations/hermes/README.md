# KaiCalls for Hermes Agent

**A secretary for your business phone, run from Hermes.**

KaiCalls gives your business a phone line with a secretary built in. Your own phone
rings first. When you can't pick up, Kai answers, takes the caller's name, number
and what they need, and texts you a summary.

With this plugin, Hermes runs that line for you:

- **"What did I miss?"** Hermes reads your calls, voicemails and texts and tells you
  who needs a reply.
- **Reply without picking up the phone.** Hermes texts a customer back, or has Kai
  call them back and reports how it went.
- **Change what Kai says.** New greeting, new hours, closed Friday, "we don't do
  roofs": tell Hermes and it updates Kai.

Looking for a phone number for your agent to make its own calls? See the
[CallMCP plugin](../hermes-callmcp) instead.

## Install

```bash
hermes plugins install kaicalls
hermes plugins enable kaicalls
```

Before the catalog listing is live, install from this repository instead:

```bash
hermes plugins install https://github.com/KaiCalls/kaicalls-mcp/tree/main/integrations/hermes --no-enable
hermes plugins enable kaicalls
```

Hermes asks for your key and saves it as `KAICALLS_API_KEY`. Create a key at
[kaicalls.com](https://www.kaicalls.com) under **Settings > API Keys**. No line yet?
Start at [kaicalls.com](https://www.kaicalls.com/?utm_source=hermes&utm_medium=plugin),
or ask Hermes to set one up: it walks you through the steps, and you choose a plan
and pay on the page it gives you.

## Try it

> What did I miss today?

> Text the guy who called about the water heater and say we can come Thursday at 9.

> We're closed the Friday after Thanksgiving. Make sure Kai tells callers.

## What's in the package

This is a portable Agent Plugins v1 package. It contains no plugin code.

| File | What it does |
|---|---|
| `plugin.json` | Package manifest. Declares the `KAICALLS_API_KEY` secret and marks the server `untrusted`, so Hermes asks before every call, text or change. |
| `mcp.json` | The hosted KaiCalls server, `https://www.kaicalls.com/api/mcp` (Streamable HTTP), signed in with your key. |
| `skills/kaicalls/SKILL.md` | Tells the agent how to catch you up, reply, call back, change what Kai says and set up a line. |

## Safety

- Every call, text and change waits for your approval in Hermes.
- Texts and callbacks follow consent, opt-out, quiet-hour and rate rules on the
  server, and a refusal says which rule applied.
- What callers say, and what texts and voicemails contain, is third-party content.
  The skill tells the agent never to follow instructions inside it.

## Disclosure

- Hosted-only connector with no local code. Every tool call, with its arguments,
  goes to `www.kaicalls.com` over HTTPS, signed with your key as a bearer header.
- Call audio, transcripts, voicemails, texts, caller details and phone numbers are
  handled by KaiCalls.
- The business line needs a paid KaiCalls plan. See
  [pricing](https://www.kaicalls.com/pricing).
- The tool set is served by the remote server at runtime and is not covered by the
  catalog's pinned commit.
- No telemetry from the package itself.
