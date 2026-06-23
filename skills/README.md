# KaiCalls Agent Skills

These are the **product connectors** KaiCalls publishes for agents to discover and
use — mirrored from the live endpoint
`https://www.kaicalls.com/.well-known/agent-skills/index.json`. They are
customer-facing surfaces of the hosted KaiCalls platform, not internal tooling.

| Skill | Type | What it is |
|-------|------|------------|
| `kaicalls-mcp` | MCP | The MCP server documented in this repo (18 tools). |
| `kaicalls-api` | OpenAPI | The KaiCalls REST API (agents, calls, leads, campaigns). Spec via [`/llms.txt`](https://www.kaicalls.com/llms.txt). |
| `kaicalls-agent-discovery` | A2A | Agent-to-Agent discovery card for KaiCalls phone agents. |
| `kaicalls-agent-signup` | OpenAPI | Programmatic, API-first onboarding + connector setup for agents. |

The canonical, signed (sha256-per-entry) index is served at the live endpoint above.
[`index.json`](index.json) here is a human-readable mirror for directory submissions.
