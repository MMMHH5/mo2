# Pull request

## What does this change, and why?

<!-- The diff shows the what. Explain the why. -->

## Related issue

<!-- e.g. Closes #12 -->

---

## Contributor License Agreement — required

Every contribution needs this before it can be merged, including one-line fixes.
You keep full ownership and copyright of your work. See [CLA.md](../CLA.md).

- [ ] I have read the CLA document and I hereby sign the CLA.

---

## Checklist

- [ ] Everything I wrote — code, comments, commit messages — is in **English**
- [ ] This PR does **one thing**
- [ ] I have not added any credential, real recording, or real transcript
- [ ] New configuration is documented in `.env.example` with a safe placeholder

**If this touches the call path (`agent/`):**

- [ ] Nothing on the audio path blocks — it is `async` throughout
- [ ] I have considered the latency budget (§B4: under 800 ms from end of caller
      speech to first audio out) and stated the impact below
- [ ] If it touches speech, I tested it **in German** — English alone proves little for
      this project

Latency impact:

<!-- Numbers if you have them, "none" if it does not touch the call path. -->

---

## Before you open this

Tel-Agent is at **Milestone 0** — a visitor types on a web page, the agent answers,
the thread holds, and the reply streams and can be cancelled. Nothing else is being
built yet. The phone is Milestone 11.

**Feature PRs will be pointed at [IDEAS.md](../IDEAS.md) rather than merged.** That is
not a judgement on the idea; it is how this project stays finishable. Bug fixes,
documentation, specification corrections, and anything that helps Milestone 0 work are
welcome now.

Security problem? **Do not open a PR** — see [SECURITY.md](../SECURITY.md).
