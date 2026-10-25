# examples/workflows/ — importable n8n examples

Ready-to-import n8n JSON workflows showing how to reach Tel-Agent from an automation
platform.

## Why these exist

**Workflow automation is explicitly out of scope for Tel-Agent.** We do not integrate
with 400 SaaS applications, and we are not going to try — n8n and Home Assistant do
that job better than we would.

Instead Tel-Agent exposes two doors, and these examples show how to walk through them:

- **Webhooks out**, each signed with a shared secret:
  `call.started` · `call.ended` · `intent.detected` · `message.taken` ·
  `tool.failed` · `system.degraded`
- **Webhook in:** `POST /hooks/call` starts an outbound call from anything that can
  send an HTTP request.

Plus the generic `http_request` tool, which lets the agent itself call any endpoint
mid-conversation.

## Planned examples

- Message taken → create a task in a project tracker
- Missed call from an unknown number → notify a Telegram channel
- Intent detected → append a row to a spreadsheet
- Nightly summary of the day's calls → email
- Inbound: a CRM row triggers an outbound call

## Note

An **n8n community node for Tel-Agent** is one of the strongest distribution channels
available to this project — a large community actively looks for new nodes. These
examples are the groundwork for it, not a substitute.

## Right now

Empty. These arrive with the webhook layer at Milestone 5.
