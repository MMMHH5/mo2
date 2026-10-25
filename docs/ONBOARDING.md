# Start here

The shortest path from finding this repository to a merged pull request. Roughly an
hour, most of it spent translating about thirty words.

**You do not need to install the project.** No backend, no `npm install`, no Python, no
API keys, no database. Git, Node 18+, and a GitHub account is the whole list.

---

## Read this first: the point is not the translation

Your first contribution here is a translation, whatever you want to work on afterwards.
Not because the project is short of translators — because the point of a first pull
request is not the work inside it. It is the loop:

```
fork  →  branch  →  commit  →  pull request  →  review  →  squash-merge into main
```

Every open-source project runs that loop. Running it once on something small is how you
learn it without simultaneously fighting a codebase you have never seen. Nobody is
teaching you to write code on this page; you are learning how people collaborate on
software that none of them owns alone.

The translation is the smallest real thing this project has. Real because it ships.
Small because it fits in an evening.

---

## The size is a ceiling, not a target

**One file. Around thirty strings. Then stop and open the pull request.**

The interface lives in [`locales/`](../locales/), one JSON file per screen — 2,972
strings across 33 files. `en`, `de` and `ar` are complete. Thirty more languages sit
there as empty directories waiting for somebody:

```
bg  cs  da  el  es  fa  fi  fr  hi  hr
hu  id  it  ja  ko  nb  nl  pl  pt  ro
ru  sk  sl  sq  sr  sv  tr  uk  vi  zh-Hans
```

Not on the list? Add your directory in the same pull request as your first file.

The smallest files are `code.json` at 16 strings, `forgot.json` at 19, `shell.json` and
`key-sign-in.json` at 22, `new-password.json` at 26. Take **one** of them.

**A pull request that translates all 33 files gets closed.** A machine-translated copy
of English looks finished, ships English to somebody who asked for their own language,
and nothing flags it. Small and real beats large and unread — that is a project rule,
not an allowance made for beginners. You come back for the next file once the first one
is merged, which is also part of what you are learning: work lands in pieces somebody
else can actually review.

---

## Do exactly this

**First, say which file you are taking.** Every language has an open issue —
[search the `i18n` label](https://github.com/Dpro-at/Tel-Agent/issues?q=is%3Aissue+is%3Aopen+label%3Ai18n)
for yours, and use
[#29](https://github.com/Dpro-at/Tel-Agent/issues/29) if it is not there yet. Leave a
comment naming the file. Nothing gets assigned and you do not wait for an answer —
several people work on one language at the same time, each on a different file, and the
comment is what stops two of you translating the same one.

```bash
# 1. Fork github.com/Dpro-at/Tel-Agent on GitHub, then clone YOUR fork
git clone https://github.com/<your-username>/Tel-Agent.git
cd Tel-Agent

# 2. The email on your commits must belong to your GitHub account, or the work
#    merges with your name on nothing
git config user.email

# 3. See what is open in your language — French shown here, use your own
node scripts/check-locales.mjs --locale fr

# 4. Branch, and take the smallest file on that list
git checkout -b feat/fr-code-json
cp locales/en/code.json locales/fr/

# 5. Translate the VALUES in locales/fr/code.json. Every key stays exactly as it is.

# 6. Confirm the number moved
node scripts/check-locales.mjs --locale fr

# 7. Push it to your fork
git add locales/fr/code.json
git commit -m "feat(locales): translate code.json into French"
git push origin feat/fr-code-json
```

Then open the pull request from your fork. Two lines have to be in the description:

```
Refs #<the number of your language's issue>
I have read the CLA document and I hereby sign the CLA.
```

The CLA line is not optional — **the first pull request cannot be merged without it**,
and it has to be that exact sentence. See [`CLA.md`](../CLA.md) for what you are
signing: you keep full ownership and copyright of your work.

`Refs`, not `Closes`. Your language's issue covers all 33 files and stays open until
the language is finished, so a pull request must not close it.

Beyond those two lines, say which language, which file, and that you checked the
placeholders. That is the whole description.

**Opening the pull request is the notification.** GitHub tells the maintainer the
moment you open it — there is nothing else to send, no message, and no need to ask
whether it arrived.

---

## Four things that get a translation sent back

- **Copying all 33 files.** One file is a complete contribution. Thirty-three is a
  problem for whoever has to read it.
- **Translating the keys.** Only the values on the right-hand side change.
- **Translating `{placeholders}`.** `{count}` and `{name}` are filled in at runtime. A
  translated placeholder breaks only in that language, so nobody catches it.
- **Machine translation nobody read.** Translate the meaning; if it reads oddly to a
  native speaker it is wrong, whatever the dictionary says. Only take a language you
  actually speak.

Product names stay as they are — Tel-Agent, WhatsApp, SMS — and so do phone numbers,
prices, timestamps and anything else in Latin script. Keep it short: these are buttons
and labels, and a translation twice the length of the English breaks the layout it sits
in. [`locales/README.md`](../locales/README.md) has the rest.

---

## What happens after you push

Somebody reads it and asks for changes. **That is the normal outcome, not a verdict on
you** — it is the part of the loop most people have never experienced, and it is the
reason to do this at all. Push follow-up commits to the same branch; do not force-push
while a review is open, because the reviewer loses their place.

A pull request is acknowledged within two days, even when the real review comes later.
If that does not happen, say so — being ignored is the project's failure, not yours.

Once it merges, everything on the board is open to you:

- The board: <https://github.com/orgs/Dpro-at/projects/6> — take from the `Ready`
  column, and look for `level: first-issue`
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — the full workflow, the scope rules, and what
  the project is not accepting yet
- [`CLAUDE.md`](../CLAUDE.md) — the working contract. It overrides every other document
- [`docs/ROADMAP.md`](ROADMAP.md) — where the project is and what comes next

Or take another locale file. There is more of that work than there will ever be people
to do it: every language is 2,972 strings, and any language anybody speaks is welcome.

---

## If you work with an AI coding agent

The repository ships this workflow as a skill at
[`.claude/skills/contributing/`](../.claude/skills/contributing/SKILL.md). An agent
working inside your clone picks it up automatically — it already knows the branch
naming, the verification gate and the rules above, so you do not have to explain them.

Two things to hold your agent to: **only take a language you actually speak and read
the output yourself**, and **do not let it widen the scope** past the one file. Both are
on you, not on the reviewer.
