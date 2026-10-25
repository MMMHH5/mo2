# Tel-Agent — Design Brief

**Read `docs/SPEC.md` Part A before starting.** This brief does not replace it; it
turns §A into an ordered piece of work with a defined deliverable.

---

## The deliverable

**One screen: Call detail (§A6.4). Dark theme. Nothing else.**

Do not design all screens up front. Do not start with onboarding, the dashboard, or
a component library.

Call detail is the heart of the product and the densest screen in it. Getting it right
settles color, type scale, density, card style, border treatment, and — the part
nothing else can teach — how speaker labels, timestamps, and intervention markers read
when someone is scanning a conversation. Once that is decided, every other screen
follows quickly from the same vocabulary.

**Definition of done for this phase:** a dark-theme Call detail screen, in all five
states from §A5, that someone could read for five minutes without eye strain.

---

## Why this screen carries the product

Principle 1 from §A1: **the transcript is the product surface.** Most time in this app
is spent reading what was said. Every other consideration — cleverness, density,
personality — loses to reading comfort.

The user opening this screen is answering one of three questions:

1. *What did the caller want?* → they read the summary, then skim the transcript
2. *Did the agent handle it correctly?* → they read the transcript closely, line by line
3. *What happened at minute 4?* → they scrub the audio and follow along

The layout has to serve all three without a mode switch.

---

## What goes on the screen

Per §A6.4:

**Header**
Caller (contact name when known, number below in monospace) · link to the contact ·
date · duration · how it was handled · detected intent.

The handling badge uses the semantic set from §A3:
green = passed through to a human · red = blocked · accent = AI handled ·
amber = needs attention.

**Audio player**
Waveform, scrubbable, **synced to the transcript**. Clicking a transcript line jumps
the audio to that moment. The currently playing line is marked in the transcript.

**Transcript** — the core of the screen
Speaker labels and timestamps, with unmistakable markers where a human took over:

```
00:03   Caller     I have an appointment Tuesday, can I move it?
00:07   Agent      Of course. What day works for you?
00:14   ──── human joined: Mohamed ────
00:16   Mohamed    Thursday at ten
00:22   ──── agent resumed ────
00:24   Agent      Booked — Thursday at 10:00. Anything else?
```

Three speaker types, visually distinct at a glance without being loud: **caller**,
**agent**, **human operator**. Timestamps in monospace, aligned, and quiet enough to
ignore while reading but present when scanning.

**Whisper channel**
Operator instructions the caller never heard. In a **visually separate side channel** —
**never inline** with what the caller actually heard. This distinction is not
decorative: someone reviewing a call for a complaint has to be able to tell, instantly
and without doubt, what was said aloud and what was not.

**Right rail**
Summary · detected intent · the list of tools the agent actually invoked, each with
its result status. A failed tool call is the most important thing on this rail — it
explains why a call went wrong.

---

## The five states (§A5)

Design all five for this screen:

| State | What it means here |
|---|---|
| Empty | No transcript — the recording failed or STT produced nothing. Say what happened. |
| Loading | Skeletons for header, waveform, and transcript lines. Not a spinner. |
| Error | The call record could not be loaded. What broke, and what to do. Never a bare code. |
| Success | Confirmation after an action on this screen — export, delete, tag. |
| Offline | The system lost SIP registration or a provider. Loud, and visible from this screen. |

---

## Constraints that will break a naive layout

These are not preferences. A design that ignores them has to be redone.

**German runs ~30% longer than English.** No fixed-width buttons or labels anywhere.
Test every layout at 1.4× string expansion. This is where most designs fail first —
the handling badge and the right-rail labels are the usual casualties.

**Arabic requires full RTL.** Mirrored layout, mirrored directional icons (arrows,
chevrons). **But Latin-script data stays LTR**: phone numbers, API keys, timestamps,
logs, code. A transcript in Arabic with an LTR timestamp column is the exact case to
get right, and it is easy to get wrong.

**Dark first, and light as a real second pass.** Not an inverted dark theme. The
primary audience runs self-hosted tools and lives in dark mode; the light theme still
has to be designed by someone who cares about it.

**Flat with clear borders.** Heavy shadows read poorly in dark mode. Elevation comes
from borders and background steps, not from blur.

**Medium density.** Denser than a consumer app, lighter than a monitoring dashboard.
The transcript is the exception: it breathes. Generous line height, comfortable reading
size. People read these for minutes at a time.

**Monospace for machine data only** — phone numbers, timestamps, API keys, logs, IDs.
Never for the transcript body.

**One accent, used sparingly.** Primary actions and live state only. If the accent is
on more than two things on this screen, it has stopped meaning anything.

---

## What comes after this screen is right

In this order, reusing the vocabulary Call detail established:

1. **Calls list** (§A6.3) — full-text search across all transcripts is the headline
   element of that screen, not a small icon in a corner
2. **Home** (§A6.2) — "Needs your attention" first, recent calls second, dial card a
   deliberate minor note
3. **Rules** (§A6.5) — three columns, drag between them
4. **Agent** (§A6.6) — including the "Try it" text-chat panel
5. **Settings** (§A6.8) — seven tabs
6. **Onboarding** (§A6.1) — designed last, because it should be assembled from
   components the rest of the product already proved

**One exception worth flagging:** the final onboarding step, the **"Call yourself now"**
button, is per §A6.1 the single most important element in the product. It is the moment
a user hears the thing work and decides whether to stay. When onboarding is designed,
that button gets treated as the payoff of the entire flow — full width, unmissable.

**Live call** (§A6.7) is its own problem and comes after the list of screens above. It
is used under time pressure, mid-conversation, and its three intervention actions —
whisper, take over, hand off — must be large and unambiguous. Whisper is built first:
highest value, lowest complexity.

---

## Notes for the designer

- The empty state matters more than it looks. A fresh install has zero calls, and the
  empty screen has to teach without a manual and offer one clear next action.
- The live call indicator (wherever it appears) **must pulse**. Not a subtle badge.
- Assume the reader is not the person who took the call, and may be reading it weeks
  later, possibly because something went wrong.
- Every field that can have a working default has one. Empty inputs make users hesitate.
- Advanced is hidden, not absent. Developers will find it; nobody else should trip
  over it.
