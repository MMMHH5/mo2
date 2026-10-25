"use client";

import { Direction } from "radix-ui";

/**
 * Tells every Radix primitive which way the layout runs, so popovers, menus and
 * sliders mirror correctly in Arabic.
 */
export function DirectionProvider({
  direction,
  children,
}: {
  direction: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  return <Direction.Provider dir={direction}>{children}</Direction.Provider>;
}
