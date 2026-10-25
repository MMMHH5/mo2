# Architecture — how the project is split

One repository, three deployable parts. This document explains where each piece of
code belongs and, more importantly, **which parts are forbidden to talk to each other**.

---

## It is not "backend and frontend". It is three parts.

The most common mistake here would be treating `agent/` and `api/` as one backend
because they are both Python. They are not. They have opposite requirements and are
separate processes.

| | `agent/` | `api/` | `web/` |
|---|---|---|---|
| Language | Python | Python (FastAPI) | Next.js + React |
| Shape | Long-running, event-driven | Request / response + WebSocket | Browser |
| Time budget | **Under 800 ms, per turn, every turn** | Normal web latency | Normal web latency |
| If it stalls for 2 s | The call sounds broken and the caller hangs up | A spinner runs slightly longer | A spinner runs slightly longer |
| Scales with | Concurrent phone calls | Dashboard users | — |
| Talks to | SIP, STT, LLM, TTS, database | Database, Redis | `api/` only |

The agent is a **soft real-time system**. The API is an ordinary web service.
Merging them would let ordinary web work — a slow query, a report, an export — block
the audio path. That is the failure this split exists to prevent.

---

## The rules

**1. `web/` talks only to `api/`.**
The browser never reaches the agent directly. Live transcripts arrive over a WebSocket
served by `api/`.

**2. `api/` never touches audio.**
No media, no codecs, no RTP. It reads what the agent wrote and serves it.

**3. `agent/` never serves the dashboard.**
It writes to the database and publishes events. It does not grow REST endpoints for
the UI.

**4. The database is the boundary between `agent/` and `api/`.**
They do not call each other. The agent writes conversations, messages and tool
invocations — plus a `calls` row when the channel is the phone; the API reads them. Redis carries live session state and the events that
`api/` fans out to connected browsers.

**5. Nothing in the audio path blocks.**
Everything on the call path is `async`. A synchronous call in `agent/session/` is a
bug even when it is fast today.

```
   phone  ──SIP──▶  agent/  ──writes──▶  PostgreSQL  ──reads──▶  api/  ──HTTP/WS──▶  web/
                      │                                            ▲
                      └──────────── events ──▶ Redis ──────────────┘
```

---

## What lives where

### `agent/` — the call
Owns everything that happens while a phone call is in progress.

| Folder | Contents |
|---|---|
| `providers/stt/` `providers/llm/` `providers/tts/` | One interface per provider type, many implementations behind it. `cancel()` on TTS is mandatory — on barge-in, audio stops instantly and queued speech is discarded. |
| `session/` | Call lifecycle, turn-taking, barge-in, whisper handling |
| `routing/` | Whitelist / blacklist / business hours — decides pass, block, or AI, from the SIP caller ID |
| `tools/` | The built-in tools the model can invoke |

### `api/` — the dashboard's backend
REST plus WebSocket, documented automatically by FastAPI. The dashboard consumes this
same API, so it exists anyway — it is simply made public and documented.

### `web/` — the dashboard
Next.js. Reads the API. Holds no business logic that the API does not already enforce;
anything the browser can bypass is not a rule.

### `locales/` — `en` / `de` / `ar`
Every user-facing string. Not code, not content work — infrastructure. German runs
about 30% longer than English and Arabic needs full RTL, so no layout may depend on
string length.

### `examples/workflows/`
Importable n8n JSON examples. Workflow automation is explicitly out of scope for
Tel-Agent; these show how to reach it through webhooks and the generic HTTP tool.

---

## Where Milestone 0 fits

**Only `agent/` is used right now**, and not even as this structure — Milestone 0 is
one script and one page, with no dashboard, no database, and no provider abstraction
beyond the model.

The folders exist today so that files land in the right place from the first day
instead of being moved later. They are not an instruction to start filling them.

`api/`, `web/`, `locales/` and `examples/` stay empty until Milestones 1–6.
See `docs/SPEC.md` §B11 for the build order, and remember the rule that governs all
of it: **nothing gets built until the agent answers on one channel, end to end.**
