# Installing the KaiCalls MCP server (for AI agents)

This file tells an AI coding agent (Cline, Claude, Cursor, or any MCP-capable
assistant) how to connect a client to the **KaiCalls** MCP server.

KaiCalls is a **hosted, remote** MCP server. There is **nothing to clone, build,
install, or run locally** — no `npm install`, no `pip install`, no process to start.
You connect a client to the live HTTPS endpoint and authenticate. Do not look for a
package to install or a command to run; the only step is editing the MCP client config.

## Connection facts

| | |
|---|---|
| **MCP endpoint** | `https://www.kaicalls.com/api/mcp` |
| **Transport** | Streamable HTTP (JSON-RPC over HTTP POST) |
| **Auth** | OAuth 2.1 (PKCE S256 + DCR) **or** a `kc_live_` API key as a Bearer token |
| **Tools** | 18 (13 read-only, 5 write/setup) |

For agent-driven setup, prefer the **API-key** path — it requires no interactive OAuth
browser round-trip.

## Prerequisite: get an API key

The user must supply a KaiCalls API key. Keys start with `kc_live_` and are minted in
the KaiCalls dashboard under **Settings → API Keys** (https://www.kaicalls.com).
If the user has not provided one, ask them for their `kc_live_` key before continuing.

## Install steps (Cline)

1. Open Cline's MCP settings file `cline_mcp_settings.json` (Cline → **MCP Servers** →
   **Configure MCP Servers**), or use the **Remote Servers** tab in the MCP panel.
2. Add the KaiCalls server under `mcpServers`:

   ```json
   {
     "mcpServers": {
       "kaicalls": {
         "url": "https://www.kaicalls.com/api/mcp",
         "type": "streamableHttp",
         "headers": { "Authorization": "Bearer kc_live_YOUR_KEY" }
       }
     }
   }
   ```

3. Replace `kc_live_YOUR_KEY` with the user's real `kc_live_` key.
4. Save the file. Cline connects to the remote endpoint and lists the KaiCalls tools.

### Critical detail

The transport type **must** be the exact camelCase string `streamableHttp`. Writing
`streamable-http` (hyphenated) or omitting `type` makes the client fall back to SSE
and the connection fails with a `405`. If you see a `405`, fix the `type` value first.

## Other MCP clients

The same connection facts apply to any MCP client that supports Streamable HTTP
remote servers — point it at `https://www.kaicalls.com/api/mcp` and send the
`Authorization: Bearer kc_live_...` header. The header `X-KaiCalls-API-Key: kc_live_...`
is also accepted. Clients that prefer OAuth can use the OAuth 2.1 flow instead of an
API key; discovery metadata is published at `/.well-known/oauth-authorization-server`
and `/.well-known/oauth-protected-resource`.

## Verify

After connecting, call the read-only tool `get_business_info` (or `list_agents`) to
confirm the connection and authentication work. A successful response means setup is
complete. Avoid calling write tools (e.g. `make_call`, which places a real outbound
phone call and consumes metered minutes) during setup verification.

## Tool catalog

The full tool list, scopes, and safety annotations are in
[`docs/tools.md`](docs/tools.md); the machine-readable inventory is in
[`mcp.json`](mcp.json) and [`server-card.json`](server-card.json).
