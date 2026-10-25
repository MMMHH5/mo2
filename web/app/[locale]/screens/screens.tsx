import Link from "next/link";

import type { Locale } from "@/lib/locales";

import type { ScreensDictionary } from "./page";

/**
 * The index of every screen in the interface. It is a review affordance, not a
 * product screen: no sidebar, no state switcher, and every card links to the real
 * route rather than a mock.
 *
 * Only the number and the route live here - the title and the description are
 * translated, so the key is what ties a card to its copy.
 */
const SCREENS: { key: keyof ScreensDictionary["items"]; index: string; href: string }[] = [
  { key: "home", index: "01", href: "/home" },
  { key: "notifications", index: "01b", href: "/notifications" },
  { key: "conversations", index: "02", href: "/conversations" },
  { key: "calls", index: "03", href: "/calls" },
  { key: "call_detail", index: "03b", href: "/calls/1" },
  { key: "live", index: "04", href: "/live" },
  { key: "calendar", index: "05", href: "/calendar" },
  { key: "contacts", index: "06", href: "/contacts" },
  { key: "assistants", index: "07", href: "/assistants" },
  { key: "campaigns", index: "07b", href: "/campaigns" },
  { key: "consent", index: "07c", href: "/consent" },
  { key: "catalogue", index: "07d", href: "/catalogue" },
  { key: "editor", index: "08", href: "/assistants/carla" },
  { key: "knowledge", index: "09", href: "/knowledge" },
  { key: "rules", index: "10", href: "/rules" },
  { key: "numbers", index: "11", href: "/numbers" },
  { key: "apps", index: "12", href: "/apps" },
  { key: "connectors", index: "12a", href: "/connectors" },
  { key: "usage", index: "13", href: "/usage" },
  { key: "settings", index: "14", href: "/settings" },
  { key: "health", index: "14a", href: "/health" },
  { key: "backup", index: "14b", href: "/backup" },
  { key: "update", index: "14c", href: "/update" },
  { key: "install", index: "14d", href: "/install" },
  { key: "workspace", index: "14e", href: "/workspaces/new" },
  { key: "login", index: "15", href: "/login" },
  { key: "forgot", index: "15a", href: "/login/forgot" },
  { key: "code", index: "15b", href: "/login/code" },
  { key: "new_password", index: "15c", href: "/login/new-password" },
  { key: "key", index: "15d", href: "/login/key" },
];

export function Screens({ locale, t }: { locale: Locale; t: ScreensDictionary }) {
  return (
    <div className="bg-od-canvas text-od-text-2 min-h-dvh text-[14px] leading-[1.45]">
      <div className="mx-auto max-w-[1080px] p-[56px_28px_90px]">
        <div className="text-od-text font-semibold tracking-[-0.01em]">{t.brand}</div>
        <h1 className="text-od-text mt-3 mb-0 text-[28px] font-semibold tracking-[-0.02em]">
          {t.title}
        </h1>
        <p className="text-od-muted-4 mt-2 max-w-[62ch] text-pretty">{t.intro}</p>

        <div className="mt-[30px] flex flex-wrap gap-[14px]">
          {/* The screen the vocabulary comes from, so it is called out rather than listed. */}
          <Link
            href={`/${locale}/calls/1`}
            className="min-w-[min(100%,280px)] flex-[1_1_300px] rounded-[10px] border border-[color:var(--od-violet-border)] bg-[rgba(139,124,255,.07)] p-[18px] text-inherit hover:bg-[rgba(139,124,255,.12)] hover:no-underline"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-[7px] rounded-full bg-[color:var(--od-violet)]" />
              <span className="text-[11px] tracking-[.08em] uppercase text-[color:var(--od-violet-3)]">
                {t.reference_label}
              </span>
            </div>
            <div className="text-od-text mt-[10px] text-[17px] font-semibold">
              {t.reference_title}
            </div>
            <div className="text-od-muted mt-[5px] text-pretty">{t.reference_desc}</div>
          </Link>

          {SCREENS.map((screen) => (
            <Link
              key={screen.index}
              href={`/${locale}${screen.href}`}
              className="border-od-line bg-od-panel-deep-3 hover:bg-od-raise hover:border-od-border-9 min-w-[min(100%,280px)] flex-[1_1_300px] rounded-[10px] border p-[18px] text-inherit hover:no-underline"
            >
              <div dir="ltr" className="mono ltr-data text-od-faint text-[11.5px]">
                {screen.index}
              </div>
              <div className="text-od-text mt-2 text-[17px] font-semibold text-pretty">
                {t.items[screen.key].title}
              </div>
              <div className="text-od-muted mt-[5px] text-pretty">{t.items[screen.key].desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
