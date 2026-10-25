# Design Handoff — Tel-Agent, Call Detail Screen

**This document is self-contained.** Everything needed to do the work is below; no
access to the repository or any other file is required.

---

## The request

Design **one screen**: the **Call detail** screen of Tel-Agent, in the **dark theme**.

**Deliver it as a single self-contained HTML file** — inline CSS, no external
resources, no build step. System fonts or a web-safe geometric sans is fine. It should
open in a browser and look finished.

Use the realistic sample data provided at the end of this document. Do not use
lorem ipsum, and do not use placeholder names like "John Doe" — this is an
Austrian product and the content should look like a real call.

### Explicitly not in scope

Do **not** design the other screens (calls list, home, routing rules, agent settings,
onboarding, live call). They are described briefly below **only so you understand the
context this screen sits in**. They come later, and they will be built from the
vocabulary this screen establishes.

Do not deliver a component library, a style tile, or a moodboard. One finished screen.

---

## What the product is

Tel-Agent is a self-hosted, open-source gateway that sits between a phone line and an
AI agent.

A phone call arrives. Tel-Agent checks the caller against routing rules and either
passes it to a human, blocks it, or hands it to an AI agent. The agent talks with the
caller in real time, can perform actions (transfer the call, take a message, check a
calendar), and every call is recorded, transcribed, and searchable.

It runs on the user's own hardware, on their own network. Think "AI receptionist you
own", not a cloud service.

**Who uses it:** primarily self-hosters and developers who run their own tools and
prefer dark interfaces. Secondarily small businesses — clinics, workshops, agencies —
who must never see a configuration file. The interface serves both: sensible defaults
on the surface, advanced controls available but not in the way.

---

## Why this screen first

**The transcript is the product surface.** Most of the time anyone spends in this
application is spent reading what was said on a call. Reading comfort beats every
other consideration — cleverness, density, personality.

Call detail is the densest screen in the product. Getting it right settles the color
palette, the type scale, the density, the card and border treatment, and — the part no
other screen can teach — how speaker labels, timestamps, and interruption markers read
when someone is scanning a conversation. Once this is right, the rest follow quickly.

**Who is reading this screen, and why.** Assume the reader is *not* the person who took
the call, and may be reading it weeks later, possibly because something went wrong.
They are answering one of three questions:

1. *What did the caller want?* → they read the summary, then skim the transcript
2. *Did the agent handle it correctly?* → they read the transcript closely, line by line
3. *What happened at minute 4?* → they scrub the audio and follow along

The layout must serve all three without a mode switch.

---

## Design principles

1. **The transcript is the product surface.** Optimize for reading comfort above all.
2. **State must be unmistakable.** Is the system live? Did the agent handle this call
   or did a human? Never make the user hunt for this.
3. **Defaults over configuration.** Every field that can have a working default has one.
4. **Advanced is hidden, not absent.** Developers will find it; nobody else should trip
   over it.
5. **Nothing depends on string length.** See the internationalization constraints.

---

## Visual system

**Theme**
Dark, designed first and properly. A light theme follows later as a real second pass —
not an inverted dark theme — so do not design in a way that only works in dark.

**Type**
- Interface: clean geometric sans (Inter or similar)
- **Monospace for machine data only**: phone numbers, timestamps, IDs, API keys, logs
- **Transcript body: never monospace.** Comfortable reading size, generous line
  height. People read these for minutes at a time.

**Color**
- **One accent**, used sparingly — primary actions and live state only. If the accent
  appears on more than two things on this screen, it has stopped meaning anything.
- Semantic set, fixed:
  - **green** — call was passed through to a human
  - **red** — call was blocked
  - **accent** — the AI agent handled it
  - **amber** — needs attention

**Density**
Medium. Denser than a consumer app, lighter than a monitoring dashboard. The transcript
is the exception — it breathes.

**Elevation**
Flat, with clear borders. Avoid heavy shadows; they read poorly in dark mode.
Elevation comes from borders and background steps, not blur.

---

## What is on this screen

### 1. Header

Caller name (when the number matches a known contact) with the phone number below it
in monospace · a link to the contact record · date · duration · a badge showing how the
call was handled · the detected intent.

The handling badge uses the semantic colors above.

### 2. Audio player

Waveform, scrubbable, **synchronized with the transcript**:

- Clicking a transcript line jumps the audio to that moment
- The line currently playing is marked in the transcript

This two-way link is a core interaction, not a nice-to-have. Show clearly in the
design how the "currently playing" line is marked.

### 3. Transcript — the core of the screen

Speaker labels and timestamps, with unmistakable markers where a human operator took
over from the agent mid-call:

```
00:03   Caller     I have an appointment on Tuesday, can I move it?
00:07   Agent      Of course. What day works for you?
00:14   ──── human joined: Mohamed ────
00:16   Mohamed    Thursday at ten
00:22   ──── agent resumed ────
00:24   Agent      Booked — Thursday at 10:00. Anything else?
```

Three speaker types, visually distinct at a glance without being loud:
**caller** · **agent** · **human operator**.

Timestamps in monospace, aligned in a column — quiet enough to ignore while reading,
present when scanning.

The takeover markers must be impossible to miss. A reader scanning a transcript should
see instantly where a human entered and where the agent resumed.

### 4. Whisper channel — read this twice

During a call, an operator can silently send an instruction to the agent. The agent
speaks it in its own voice, and **the caller never knows the operator was involved**.

These whispered instructions must appear in a **visually separate side channel** and
**never inline** with the spoken transcript.

This distinction is not decorative. Someone reviewing this call because of a complaint
has to be able to tell, instantly and with zero doubt, what was actually said aloud to
the caller and what was an internal instruction. If a reader could confuse the two, the
design has failed at its most important job.

### 5. Right rail

- **Summary** of the call
- **Detected intent**
- **Tools the agent actually invoked**, each with its result status

A **failed tool call is the most important item on this rail** — it is usually the
explanation for why a call went wrong. Design that failure state deliberately; do not
let it look like just another list row.

---

## The five states

Design the screen in all five. Do not deliver only the happy path.

| State | What it means on this screen |
|---|---|
| **Default** | The full screen with content — the sample data below |
| **Empty** | No transcript exists: the recording failed, or speech recognition returned nothing. Explain what happened. |
| **Loading** | **Skeletons, not spinners** — for the header, waveform, and transcript lines |
| **Error** | The call record could not be loaded. Say what broke and what to do. **Never a bare error code.** |
| **Offline** | The system has lost its phone-line registration or a provider is unreachable. **This must be loud** and visible from this screen. |

---

## Constraints that will break a naive layout

These are not preferences. A design that ignores them has to be redone.

**German text runs about 30% longer than English.** The product ships in English,
German, and Arabic from day one, and the primary market is Austria — so German is the
realistic case, not the edge case. **No fixed-width buttons or labels anywhere.** Every
layout must survive 1.4× string expansion without breaking. The handling badge and the
right-rail labels are where this usually fails first.

**Arabic requires full right-to-left layout.** Mirrored layout, mirrored directional
icons (arrows, chevrons). **But Latin-script data stays left-to-right**: phone numbers,
timestamps, IDs, code. An Arabic transcript with a left-to-right timestamp column is
exactly the case to get right, and it is easy to get wrong. You do not need to deliver
an Arabic version — but the layout must not be structurally hostile to one.

**Dark first, light later as a real pass.** Do not rely on effects that only work on a
dark ground.

**Flat with clear borders.** No heavy shadows.

**One accent only.** Used sparingly.

---

## Sample data — use this, not lorem ipsum

A real call to a physiotherapy practice in Vienna, handled by the AI agent, with a
human operator briefly taking over. English is used here for readability; the real
product runs this in Austrian German.

**Header**
- Contact: **Anna Gruber** · `+43 664 1234567`
- Date: 14 August 2026, 09:41
- Duration: 2:38
- Handled by: **AI agent** (accent badge)
- Detected intent: **Appointment change**

**Transcript**

```
00:00   Agent      Praxis Wagner, good morning. This call is recorded.
                   How can I help you?
00:06   Caller     Good morning, Gruber here. I have an appointment on
                   Tuesday and I need to move it.
00:13   Agent      Of course, Ms Gruber. I can see your appointment on
                   Tuesday at 14:00. What day would suit you better?
00:21   Caller     Thursday would be better, in the morning if possible.
00:26   Agent      One moment, let me check the calendar.
00:31   Agent      Thursday at 10:00 is free. Should I put you down
                   for that?
00:36   Caller     Yes please. And I wanted to ask about the referral —
                   do I need a new one from my doctor?
00:44   Agent      Let me check that for you.
00:47   ──── human joined: Mohamed ────
00:49   Mohamed    Hello Ms Gruber, this is Mohamed from reception.
                   Your referral is valid until the end of September,
                   so you do not need a new one.
01:02   Caller     Perfect, thank you.
01:04   ──── agent resumed ────
01:06   Agent      Then you are booked for Thursday at 10:00. You will
                   get a confirmation by SMS. Anything else?
01:14   Caller     No, that is everything. Thank you.
01:17   Agent      Thank you for calling, Ms Gruber. Goodbye.
```

**Whisper channel** — operator instructions the caller never heard

```
00:44   Operator → Agent    The referral is valid until 30 September.
                            Tell her she does not need a new one.
01:04   Operator → Agent    Confirm the booking and close politely.
```

*(Note: in this sample the operator chose to speak directly at 00:49 rather than let
the agent voice the whisper. Both paths exist — design the channel so it reads
correctly either way.)*

**Right rail — summary**

> Ms Gruber moved her Tuesday 14:00 appointment to Thursday 10:00 and asked whether
> her referral was still valid. Reception confirmed it is valid until 30 September.
> SMS confirmation sent.

**Right rail — tools invoked**

| Tool | Result | Time |
|---|---|---|
| `search_knowledge` — referral validity rules | Success | 240 ms |
| `check_calendar` — availability Thursday | Success | 890 ms |
| `check_calendar` — propose 10:00 booking | Success | 1,120 ms |
| `send_notification` — SMS confirmation | **Failed — SMS gateway timeout** | 5,000 ms |

The failed row is deliberate. Show how a failure reads on this rail — this is the
detail a reviewer is looking for.

---

## The screens that come later — context only, do not design these

So you understand what vocabulary this screen needs to establish:

- **Calls list** — a table of calls; full-text search across every transcript is its
  headline feature
- **Home** — "Needs your attention" first, recent calls second, a deliberately minor
  dial card
- **Routing rules** — three columns: always through · blocked · AI handles
- **Agent** — persona prompt, voice, knowledge sources, tool toggles, a text-chat panel
- **Settings** — seven tabs
- **Live call** — shown while a call is in progress, with three large intervention
  actions (whisper · take over · hand off), used under time pressure
- **Onboarding** — three steps, designed last, ending in one large **"Call yourself
  now"** button that is the single most important element in the product

A live-call indicator will appear in the product, and wherever it appears **it must
pulse** — not a subtle badge.

---

## Acceptance checklist

- [ ] Dark theme, finished, not a wireframe
- [ ] All five states delivered
- [ ] A transcript that is genuinely comfortable to read for five minutes
- [ ] Human takeover markers impossible to miss when scanning
- [ ] Whisper channel visually separate — never confusable with what the caller heard
- [ ] The failed tool call reads as the important item it is
- [ ] The "currently playing" transcript line is clearly marked
- [ ] Nothing breaks at 1.4× string length
- [ ] Accent color appears on no more than two things
- [ ] Monospace only on machine data, never on the transcript body
- [ ] Single self-contained HTML file, opens in a browser with no build step
