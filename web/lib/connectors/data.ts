/**
 * MCP servers the assistants call while a caller is on the line. Most are not ours —
 * Tel-Agent only decides which of their tools may run.
 *
 * Every piece of prose is a key into `locales/<lang>/connectors.json`. What stays a
 * literal here is machine-readable: tool identifiers, transports and addresses,
 * version numbers, durations, and the names people gave their own assistants.
 */

import type { ConnectorsDictionary } from "@/app/[locale]/connectors/page";

export type Key = keyof ConnectorsDictionary;

export type Status = "connected" | "failing" | "notStarted";
export type Origin = "you" | "third" | "thirdHosted";

/** A tool's name is what the server calls it, so it is never translated. */
export type Tool = {
  name: string;
  kind: "read" | "write";
  on: boolean;
  desc: Key;
  /** How often it ran: a count that is worded, or the word for never. */
  stat: Key;
  statCount?: number;
};

/** A figure is either measured (machine) or worded (copy), never both. */
export type Stat = {
  label: Key;
  value?: Key;
  valueText?: string;
  note?: Key;
  noteText?: string;
};

export type LogRow = {
  time?: string;
  timeKey?: Key;
  tool: string;
  outcome: "ok" | "empty" | "notFound" | "failed";
  ms: string;
};

export type Connector = {
  id: string;
  /** Two-letter monogram. Fixed here so it does not change with the language. */
  mark: string;
  name: Key;
  origin: Origin;
  transport: string;
  status: Status;
  desc: Key;
  usedBy: Key;
  usedByCount?: number;
  error?: { title: Key; body: Key; log: string };
  stats: Stat[];
  tools: Tool[];
  /** The assistant's name is what its owner typed; the tool list is identifiers. */
  assistants: { name: string; tools: string }[];
  log: LogRow[];
};

export const CONNECTORS: Connector[] = [
  {
    id: "calendar",
    mark: "bu",
    name: "c_calendar_name",
    origin: "you",
    transport: "stdio · /srv/mcp/calendar",
    status: "connected",
    desc: "c_calendar_desc",
    usedBy: "used_by_many",
    usedByCount: 3,
    stats: [
      { label: "stat_uptime", value: "c_calendar_uptime", note: "stat_since_restart" },
      { label: "stat_calls_today", valueText: "84", note: "c_calendar_split" },
      { label: "stat_slowest", valueText: "410 ms", noteText: "book_appointment" },
      { label: "stat_version", valueText: "0.9.1", note: "stat_checked_morning" },
    ],
    tools: [
      { name: "check_calendar", kind: "read", on: true, desc: "tool_check_calendar_desc", stat: "stat_today", statCount: 58 },
      { name: "book_appointment", kind: "write", on: true, desc: "tool_book_appointment_desc", stat: "stat_today", statCount: 22 },
      { name: "cancel_appointment", kind: "write", on: false, desc: "tool_cancel_appointment_desc", stat: "stat_never" },
    ],
    assistants: [
      { name: "Rezeption Wagner", tools: "check_calendar, book_appointment" },
      { name: "Nachbetreuung", tools: "check_calendar" },
      { name: "Notdienst", tools: "check_calendar" },
    ],
    log: [
      { time: "09:41", tool: "check_calendar", outcome: "ok", ms: "118 ms" },
      { time: "09:38", tool: "book_appointment", outcome: "ok", ms: "402 ms" },
      { time: "09:31", tool: "check_calendar", outcome: "ok", ms: "96 ms" },
      { time: "09:12", tool: "check_calendar", outcome: "empty", ms: "104 ms" },
    ],
  },
  {
    id: "records",
    mark: "cu",
    name: "c_records_name",
    origin: "you",
    transport: "http · records.local:7300",
    status: "connected",
    desc: "c_records_desc",
    usedBy: "used_by_many",
    usedByCount: 2,
    stats: [
      { label: "stat_uptime", value: "c_records_uptime", note: "c_records_restart" },
      { label: "stat_calls_today", valueText: "51", note: "c_records_split" },
      { label: "stat_slowest", valueText: "1.2 s", noteText: "order_status" },
      { label: "stat_auth", value: "auth_bearer_short", note: "c_records_rotated" },
    ],
    tools: [
      { name: "lookup_customer", kind: "read", on: true, desc: "tool_lookup_customer_desc", stat: "stat_today", statCount: 39 },
      { name: "order_status", kind: "read", on: true, desc: "tool_order_status_desc", stat: "stat_today", statCount: 12 },
      { name: "list_invoices", kind: "read", on: false, desc: "tool_list_invoices_desc", stat: "stat_never" },
    ],
    assistants: [
      { name: "Rezeption Wagner", tools: "lookup_customer" },
      { name: "Nachbetreuung", tools: "lookup_customer, order_status" },
    ],
    log: [
      { time: "09:44", tool: "lookup_customer", outcome: "ok", ms: "232 ms" },
      { time: "09:40", tool: "order_status", outcome: "ok", ms: "1.2 s" },
      { time: "09:22", tool: "lookup_customer", outcome: "notFound", ms: "190 ms" },
      { time: "08:58", tool: "lookup_customer", outcome: "ok", ms: "205 ms" },
    ],
  },
  {
    id: "tomedo",
    mark: "to",
    name: "c_tomedo_name",
    origin: "third",
    transport: "http · tomedo-mcp.local:8801",
    status: "failing",
    desc: "c_tomedo_desc",
    usedBy: "used_by_one",
    error: {
      title: "c_tomedo_error_title",
      body: "c_tomedo_error_body",
      log: "POST /mcp → 401 unauthorized · token expired_at 2026-08-21T05:12:09Z",
    },
    stats: [
      { label: "stat_down_for", value: "c_tomedo_down", note: "c_tomedo_since" },
      { label: "stat_failed_calls", valueText: "17", note: "c_tomedo_all401" },
      { label: "stat_fallback", value: "c_tomedo_fallback", note: "c_tomedo_not_told" },
      { label: "stat_version", valueText: "0.4.2", note: "c_tomedo_build" },
    ],
    tools: [
      { name: "find_patient", kind: "read", on: true, desc: "tool_find_patient_desc", stat: "stat_today", statCount: 0 },
      { name: "next_free_slot", kind: "read", on: false, desc: "tool_next_free_slot_desc", stat: "stat_never" },
    ],
    assistants: [{ name: "Notdienst", tools: "find_patient" }],
    log: [
      { time: "09:39", tool: "find_patient", outcome: "failed", ms: "—" },
      { time: "09:07", tool: "find_patient", outcome: "failed", ms: "—" },
      { time: "08:20", tool: "find_patient", outcome: "failed", ms: "—" },
      { time: "07:11", tool: "find_patient", outcome: "ok", ms: "480 ms" },
    ],
  },
  {
    id: "stripe",
    mark: "st",
    name: "c_stripe_name",
    origin: "thirdHosted",
    transport: "https · mcp.stripe.com",
    status: "connected",
    desc: "c_stripe_desc",
    usedBy: "used_by_one",
    stats: [
      { label: "stat_data_leaves", value: "yes", note: "c_stripe_consent" },
      { label: "stat_calls_today", valueText: "6", note: "c_stripe_lookups" },
      { label: "stat_slowest", valueText: "620 ms", noteText: "payment_status" },
      { label: "stat_auth", value: "auth_restricted", note: "stat_read_only" },
    ],
    tools: [
      { name: "payment_status", kind: "read", on: true, desc: "tool_payment_status_desc", stat: "stat_today", statCount: 6 },
      { name: "create_payment_link", kind: "write", on: false, desc: "tool_create_payment_link_desc", stat: "stat_never" },
    ],
    assistants: [{ name: "Nachbetreuung", tools: "payment_status" }],
    log: [
      { time: "09:15", tool: "payment_status", outcome: "ok", ms: "298 ms" },
      { time: "08:47", tool: "payment_status", outcome: "ok", ms: "620 ms" },
      { timeKey: "when_yesterday", tool: "payment_status", outcome: "ok", ms: "270 ms" },
      { timeKey: "when_yesterday", tool: "payment_status", outcome: "notFound", ms: "240 ms" },
    ],
  },
  {
    id: "billing",
    mark: "bi",
    name: "c_billing_name",
    origin: "you",
    transport: "stdio · /srv/mcp/billing",
    status: "notStarted",
    desc: "c_billing_desc",
    usedBy: "used_by_none",
    stats: [
      { label: "stat_state", value: "c_billing_state", note: "c_billing_added" },
      { label: "stat_tools", valueText: "2", note: "c_billing_both_off" },
      { label: "stat_calls", valueText: "0", noteText: "—" },
      { label: "stat_owner", valueText: "Sabine", note: "c_billing_owner_note" },
    ],
    tools: [
      { name: "draft_invoice", kind: "write", on: false, desc: "tool_draft_invoice_desc", stat: "stat_never" },
      { name: "invoice_status", kind: "read", on: false, desc: "tool_invoice_status_desc", stat: "stat_never" },
    ],
    assistants: [],
    log: [],
  },
];

export const CONNECTOR_KINDS: { id: string; label: Key; note: Key }[] = [
  { id: "stdio", label: "kind_stdio", note: "kind_stdio_note" },
  { id: "http", label: "kind_http", note: "kind_http_note" },
  { id: "hosted", label: "kind_hosted", note: "kind_hosted_note" },
];

export const ADDRESS_FOR: Record<string, string> = {
  stdio: "/srv/mcp/records",
  http: "http://records.local:7300",
  hosted: "https://mcp.example.com/v1",
};

/** The right-hand detail is a measurement or a protocol string except where noted. */
export const HANDSHAKE: { label: Key; detail?: Key; detailText?: string }[] = [
  { label: "hs_reached", detailText: "42 ms" },
  { label: "hs_protocol", detailText: "MCP 2025-06-18" },
  { label: "hs_authenticated", detail: "hs_key_accepted" },
  { label: "hs_listed", detail: "hs_found" },
];

/** The three tools the wizard pretends to discover. They are not installed yet. */
export const FOUND_TOOLS: Tool[] = [
  { name: "lookup_customer", kind: "read", on: false, desc: "tool_lookup_customer_desc", stat: "stat_never" },
  { name: "order_status", kind: "read", on: false, desc: "tool_order_status_desc", stat: "stat_never" },
  { name: "create_order", kind: "write", on: false, desc: "tool_create_order_desc", stat: "stat_never" },
];
