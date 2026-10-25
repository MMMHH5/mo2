import { BRAND_MARKS } from "./marks";

export { BRAND_MARKS } from "./marks";

/**
 * Where a catalogue id and the owner's own name differ. `instagram_dm` is our name for
 * the channel; the logo on it is Instagram's.
 */
const ALIASES: Record<string, string> = {
  instagram_dm: "instagram",
  facebook_messenger: "messenger",
  // CompanyFlex is a Telekom product and carries the Telekom mark.
  telekom_companyflex: "deutsche-telekom",
};

/** The mark for a catalogue id, or nothing - in which case the caller draws its letter. */
export function brandSlug(id: string): string | null {
  const slug = ALIASES[id] ?? id;
  return slug in BRAND_MARKS ? slug : null;
}

/**
 * Some marks are black or near-black by definition - Matrix, OpenAI, Anthropic, Twilio.
 * Drawing those in "the brand's own colour" makes them invisible on the dark ground, and
 * white ones vanish on the light one. A mark with no colour of its own is neutral: it is
 * drawn in the interface's text colour, which is what `currentColor` was for all along.
 */
function isNeutral(hex: string): boolean {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.14 || luminance > 0.92;
}

/**
 * One brand mark inside the same rounded square the lettered marks use, so a row of
 * channels keeps one silhouette whether the entry has a logo or a letter.
 *
 * A `mono` mark is drawn in the owner's own colour on a tint of it - the same treatment
 * the lettered marks get, except the colour is the brand's rather than a hash of its id.
 * `art` keeps its published colours on a neutral ground, and `bleed` carries its own
 * background, so it fills the square and takes no tint at all.
 */
export function BrandMark({ id, size = 40 }: { id: string; size?: number }) {
  const slug = brandSlug(id);
  const mark = slug ? BRAND_MARKS[slug] : undefined;
  if (!mark) return null;

  const bleed = mark.kind === "bleed";
  const glyph = Math.round(size * (mark.kind === "mono" ? 0.52 : 0.62));
  const tinted = mark.kind === "mono" && !isNeutral(mark.hex);

  return (
    <span
      className="inline-flex flex-none items-center justify-center overflow-hidden rounded-[10px] border"
      style={{
        width: size,
        height: size,
        borderColor: tinted
          ? `color-mix(in oklab, ${mark.hex} 36%, transparent)`
          : "var(--od-border-6)",
        background: tinted
          ? `color-mix(in oklab, ${mark.hex} 14%, transparent)`
          : "var(--od-raise-2)",
        color: tinted ? mark.hex : "var(--od-text-3)",
      }}
    >
      <svg
        viewBox={mark.viewBox}
        width={bleed ? size : glyph}
        height={bleed ? size : glyph}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        {mark.node}
      </svg>
    </span>
  );
}

/**
 * The mark on its own, with no container - for use inside a pill or a row of text where
 * the label is already there and the logo is only helping the eye find it.
 *
 * The neutral rule applies here too: a mark with no colour of its own follows the text
 * it sits beside rather than being painted black on a dark ground.
 */
export function BrandGlyph({ id, size = 13 }: { id: string; size?: number }) {
  const slug = brandSlug(id);
  const mark = slug ? BRAND_MARKS[slug] : undefined;
  if (!mark) return null;

  const tinted = mark.kind === "mono" && !isNeutral(mark.hex);

  return (
    <svg
      viewBox={mark.viewBox}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ color: tinted ? mark.hex : "currentColor", flex: "none" }}
    >
      {mark.node}
    </svg>
  );
}
