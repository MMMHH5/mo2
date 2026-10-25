# web/ — the dashboard

Next.js + React. The interface a user actually spends time in.

## The rules

**This app talks only to `api/`.** It never reaches the agent directly. Live
transcripts arrive over a WebSocket served by the API.

**No business logic that the API does not already enforce.** Anything the browser can
bypass is not a rule — it is a suggestion. Validate in the UI for comfort; enforce in
the API for correctness.

**Nothing may depend on string length.** German runs about 30% longer than English and
is the realistic case, not the edge case — the primary market is Austria. No fixed-width
buttons or labels. Every layout must survive 1.4× string expansion.

**Arabic needs full RTL** — mirrored layout, mirrored directional icons. But
Latin-script data stays LTR: phone numbers, timestamps, IDs, logs, code.

**Dark theme first**, light as a real second pass rather than an inversion. The bright
amber that works on dark scores about 1.7 on white — invisible. Inversion does not work.

## Every screen needs five states

Empty · Loading (skeletons, not spinners) · Error (what broke and what to do, never a
bare code) · Success · Offline (SIP registration or a provider is gone — this must be
loud).

Empty states matter most: a fresh install is entirely empty and must teach without a
manual.

## Design order

The **call detail** screen is designed and built first, alone. It is the heart of the
product and it settles the colour, type, density and card vocabulary that every other
screen inherits.

Then: calls list → home → rules → agent → settings. Onboarding is designed **last**,
because it should be assembled from components the rest of the product already proved.

See `docs/DESIGN_BRIEF.md` and `docs/brand/palette.html`.

## Right now

Empty. This arrives at Milestone 4.
