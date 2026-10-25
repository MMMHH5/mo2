# Security Policy

Tel-Agent answers phone calls, holds provider API keys, and can place outbound calls
that cost real money. Security reports are taken seriously.

---

## Reporting a vulnerability

**Do not open a public issue, pull request, or discussion for a security problem.**

Report it privately, either way:

1. **GitHub private vulnerability reporting** — the *Security* tab of this repository,
   "Report a vulnerability". Preferred: it keeps the report attached to the code.
2. **Email** — [info@dpro.at](mailto:info@dpro.at) with `SECURITY` in the subject.

Please include what you can: what the issue is, how to reproduce it, what an attacker
gains, and the version or commit you tested.

**What to expect.** This is a small team on a young project, so no formal response time
is promised. We aim to acknowledge a report within five working days and to keep you
informed while it is being looked at. If you have heard nothing after that, send a
reminder — it means the message was missed, not ignored.

You will be credited in the fix unless you prefer otherwise.

---

## Supported versions

| Version | Supported |
|---|---|
| pre-alpha (`main`) | Fixes land on `main` |

**There is no released version yet.** Tel-Agent is at Milestone 0 and is not ready for
production use. Do not run it on a business phone line.

---

## What is in scope

- Anything that lets an unauthorised party **place an outbound call**. There are three
  such paths — `/api/calls/outbound`, `/hooks/call` and the MCP endpoint — and toll
  fraud on any of them costs the operator money directly. See §B9.1 of the
  specification.
- Exposure of **API keys or SIP credentials**, in logs, API responses, error messages,
  or the interface.
- Unauthorised access to **call recordings or transcripts**. These are personal data
  under GDPR.
- Authentication and authorisation flaws, including anything that lets one tenant read
  another's data.
- Bypassing the **recording announcement**. In Austria both parties must be aware a
  call is recorded, so suppressing it is a legal problem, not only a technical one.
- Injection through call content — a caller who can make the agent perform an action it
  should not, for example invoking a tool through what they say.

## What is not in scope

- **Deployment choices the operator makes.** Exposing the port to the internet,
  reusing a weak SIP password, or skipping HTTPS are documented risks, not
  vulnerabilities in Tel-Agent. The documentation states the supported paths: VPN,
  Tailscale, or a reverse proxy with HTTPS.
- **Vulnerabilities in third-party providers.** Report those to the provider. Tell us
  as well if Tel-Agent's use of them makes the impact worse.
- Missing hardening headers or similar findings with no demonstrated impact.
- Anything requiring an attacker to already have administrative access.

---

## Notes for operators

Until there is a release, these matter more than any code fix:

- **Do not expose the service to the internet.** Use a VPN, Tailscale, or a reverse
  proxy with HTTPS.
- **Configure geographic dialling permissions at your telephony provider** and disable
  every country you do not need to call. This is the single most effective protection
  against toll fraud, it is free, and it works even if Tel-Agent itself has a bug.
  It is **not** enabled by default on a new provider account.
- **Use a strong password on the SIP extension.** Brute-forcing weak extension
  credentials is a common way in.
- **Disable outbound calling on the agent's extension** while the agent only answers
  calls.
- **Keep `.env` out of version control.** It is gitignored; keep it that way.
