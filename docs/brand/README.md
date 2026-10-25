# Brand assets — Dpro GmbH

These are the **Dpro GmbH** company assets, not Tel-Agent product assets.
Tel-Agent has its own identity; see "How these are used" below.

## Files

| File | Contents | Use on |
|---|---|---|
| `dpro-logo-full-color.png` | Mark + "Dpro" wordmark, full colour, transparent background, 2084×2084 | Light backgrounds |
| `dpro-logo-full-color.jpg` | Same artwork, white background, 1042×1042, no transparency | Only where PNG is not accepted |
| `dpro-icon-color.png` | Mark alone, no wordmark, full colour, transparent, 2084×2084 | Favicons, avatars, app icons |
| `dpro-logo-black.png` | Monochrome dark version, transparent, 2084×2084 | Light backgrounds, print, single-colour output |
| `dpro-logo-white.png` | Monochrome white version, transparent, 2084×2084 | **Dark backgrounds only** — it is invisible on white |

All PNGs are 32-bit with a real alpha channel. The JPG has none.

**No vector source (SVG / AI / EPS) is present.** Everything here is raster at 2084 px.
That is enough for the web and for favicons, but not for print or for large-format
output. If the original Illustrator file exists, adding an SVG here would be worth the
five minutes.

The `logo_Plan de travail 1` filenames the assets arrived with were Illustrator
artboard exports ("Plan de travail" = artboard in French). They have been renamed;
the artwork is untouched.

## Colours

Sampled from the artwork, not guessed:

| Role | Hex | Notes |
|---|---|---|
| Dpro orange | `#F7941D` | Left facet of the mark, and the "D" of the wordmark |
| Dpro purple | `#652D91` | Right facet of the mark |
| Dpro purple, light | `#A286BE` | Top and bottom facets |
| Wordmark grey | `#3A3A3C` | The "pro" of the wordmark |

The mark is a diamond built from four facets around a knocked-out centre. The centre
is **transparent, not white** — it takes the colour of whatever sits behind it. On a
busy background it will read as a hole, so give the logo a clear area.

## How these are used

Tel-Agent is a separate product with its own identity — the specification is explicit
that it stays separate from Dpro's other projects. So:

- **Use these** for company attribution: the README footer, the CLA, documentation,
  "maintained by Dpro GmbH".
- **Do not use these** as the Tel-Agent application's own logo, favicon, or interface
  chrome. Tel-Agent needs its own mark.

### Two things to settle before the interface uses any of this

**1. The brand orange collides with a semantic colour.** The design specification
assigns **amber** to "needs attention". Dpro orange `#F7941D` is close enough to amber
that using it as the interface accent would make every accent element look like a
warning. If an Tel-Agent accent is derived from this palette, take it from the purple,
not the orange.

**2. The purple is too dark for a dark theme.** `#652D91` on a near-black background
has very low contrast and will fail accessibility checks for text or icons. The light
purple `#A286BE` is the usable one on dark; `#652D91` works on light. Since the product
is designed dark-first, this matters from the first screen.

Neither of these is decided yet. They are flagged here so the decision is deliberate
rather than accidental.
