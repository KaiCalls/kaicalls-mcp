# KaiCalls on Muse: connector submission packet

Everything needed to list KaiCalls in the **Muse Connector Platform** (Meta's Muse, [muse.ai/platform](https://muse.ai/platform), open to third-party connectors as of 2026-09-18).

Muse's model is "you bring the API, Muse brings the agent, the browser, and the context." For KaiCalls, that means someone can ask Muse *"who called my business today?"* and Muse reads the answer from the hosted KaiCalls MCP server.

| File | What it is |
|---|---|
| [`submission.json`](submission.json) | Paste-ready value for every field on the Muse submission form. Keys match the form's submit payload. |
| [`icon-512.png`](icon-512.png) | Connector icon: 512×512 PNG, 66 KB (Muse requires a 512×512 PNG/SVG of 256 KiB or less). |

---

## Listing description (SEO copy)

Muse's form has no separate "description" field. The long copy goes in **Anything else?** and the example prompts go in **Example prompts**. We use the same copy anywhere else KaiCalls is listed.

**Short (≤160 chars):**
> KaiCalls is the AI secretary that answers your business calls. Ask Muse who called, read transcripts, manage leads, and text callers back.

**Long:**
> KaiCalls is an AI secretary and answering service for small businesses. It answers missed and after-hours calls, captures each caller as a lead, writes a transcript and summary, texts the caller the next step, and alerts the owner. With the KaiCalls connector, just ask Muse who called, what they wanted, which leads are new, and what happens next. Then act on it: update a lead, text a caller back, or hear a preview call, without opening a dashboard.

Search terms this copy targets: *AI secretary, AI receptionist, answering service, missed calls, after-hours calls, call transcripts, call summaries, lead capture, text back missed calls, small business phone.* We say "secretary" and "answering service", never "voice AI", "bot" or "agent".

---

## How Muse connectors work (researched 2026-09-19)

These details come from the live form code shipped at `muse.ai/platform`, deploy `dpl_F2gw9egkRUbRqBnaDdJrC25VkrZA`.

- **Format:** Muse has no manifest file, no repo PR and no spec upload. You submit through a **hosted web form**, and it only opens if you are **logged in to a Muse account**. Logged-out visitors get the Muse sign-in first.
- **Connection type:** `Raw API` (API URL plus an optional OpenAPI URL) **or** `Existing MCP` (a hosted MCP endpoint, which must be HTTPS). **KaiCalls uses `Existing MCP`.**
- **Auth methods (multi-select, optional):** `API keys`, `OAuth with PKCE`, `Other` (free text). KaiCalls supports the first two.
- **Review:** Muse reviews functional, security and legal requirements, then runs end-to-end testing. Approved connectors appear in the Muse directory, and Muse editors pick featured placement based on usage. Muse says it will be in touch after review. It publishes no SLA.
- **Payments:** Muse partners with Stripe (Link) for connectors that take payments. Each submission declares whether it accepts payments.
- **Terms:** Submitting means agreeing to the *Muse Connector Terms* (`muse.ai/platform/terms`). That page only renders for signed-in users, so read it at submit time.

### Form fields and validation

**Step 1: Overview**

| Field | Required | Rule | KaiCalls value |
|---|:-:|---|---|
| Connector name | ✓ | ≤ 80 chars | `KaiCalls` |
| Company or developer | ✓ | ≤ 120 chars | `KaiCalls` |
| Product website | ✓ | http(s) URL | `https://www.kaicalls.com` |
| Example prompts | ✓ | free text | see `useCases` in `submission.json` |
| Connector icon | ✓ | 512×512 PNG/SVG, ≤ 256 KiB | `icon-512.png` |
| Payments | ✓ | accepts / does not accept | **does not accept payments** (see decision 1) |
| Your name | ✓ | | `Connor Gallic` |
| Work email | ✓ | company email | `connor@kaicalls.com` |
| Support email or URL | ✓ | email or URL | `https://www.kaicalls.com/contact` |
| Privacy policy | ✓ | http(s) URL | `https://www.kaicalls.com/privacy-policy` |
| Terms of service | ✓ | http(s) URL | `https://www.kaicalls.com/terms-of-service` |
| Anything else? | | | long description + technical notes |

**Step 2: Technical specs**

| Field | Required | Rule | KaiCalls value |
|---|:-:|---|---|
| Connection type | ✓ | Raw API / Existing MCP | **Existing MCP** |
| Hosted MCP endpoint | ✓ | HTTPS only | `https://www.kaicalls.com/api/mcp` |
| API or MCP documentation | ✓ | http(s) URL | `https://www.kaicalls.com/docs/api/connectors` |
| Access requirements | ✓ | free text | see `limits` in `submission.json` |
| Authentication methods | | multi-select | `OAuth with PKCE`, `API keys` |

**Step 3: Review.** Three required checkboxes that only the account owner should tick:
1. *I confirm I'm authorized to submit this connector and its brand assets.*
2. *I understand that submission doesn't guarantee approval and promotion is based on usage and editorial discretion.*
3. *I agree to the Muse Connector Terms.*

---

## KaiCalls endpoint check (live, 2026-09-19)

| Check | Result |
|---|---|
| `POST https://www.kaicalls.com/api/mcp` without auth | `401`, `WWW-Authenticate: Bearer resource_metadata="https://www.kaicalls.com/.well-known/oauth-protected-resource"` ✓ |
| `/.well-known/oauth-protected-resource` | resource `https://www.kaicalls.com/api/mcp`, AS `https://www.kaicalls.com`, 21 scopes ✓ |
| `/.well-known/oauth-authorization-server` | authorize `/api/oauth/authorize`, token `/api/oauth/token`, DCR `/api/oauth/register`, PKCE `S256`, CIMD supported ✓ |
| `/.well-known/mcp/server-card.json` | 69 tools on the account surface, all annotated ✓ |
| Privacy, terms, contact, docs URLs | all `200` ✓ |

Muse runs in Meta's cloud, so the endpoint has to be publicly reachable. It is.

---

## Submitting (account owner only)

1. Sign in to Muse (US, 18+) as the KaiCalls owner.
2. Go to <https://muse.ai/platform> and click **Submit a connector**.
3. **Overview:** paste the values from `submission.json`. Put one example prompt per line in **Example prompts**. Upload `icon-512.png`.
4. **Technical specs:** choose **Existing MCP**, paste the endpoint, the docs URL and the access requirements, and tick **OAuth with PKCE** and **API keys**.
5. **Review:** read the Muse Connector Terms, tick the three attestations, and click **Submit for review**.
6. Before or right after submitting, add a Muse custom connector to `https://www.kaicalls.com/api/mcp` from the same account. Confirm the OAuth consent flow finishes and `list_recent_calls` returns data, so the Muse review's end-to-end test passes on the first try.

### Open decisions

1. **Payments.** The connector exposes `create_checkout`, which returns a *Stripe-hosted* checkout link for the owner to open. Payment never happens inside Muse, so the packet declares **does not accept payments** and discloses the checkout link in the notes. Choose "accepts payments" only if KaiCalls wants Muse's Stripe Link path for in-agent purchase.
2. **Review test account.** Muse runs end-to-end tests. Either create a demo business with sample calls and leads, or answer Muse's request when it comes. The notes offer one "on request".
3. **Static OAuth client.** KaiCalls supports DCR and CIMD. If Muse's reviewers ask for a fixed `client_id` and redirect URI instead, register one against Muse's callback host.
