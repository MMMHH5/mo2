# Award seal

The wreath lockup from the Flowxtra registration page: laurel branches around
"Product of the day" and "1st".

| File | Ink | For |
|---|---|---|
| `product-of-the-day-light.svg` | `#18181B` | GitHub's light theme |
| `product-of-the-day-dark.svg` | `#FFFFFF` | GitHub's dark theme |

Both are 320x103 with a **transparent background**, so the seal sits on GitHub's own
page colour rather than on a card of its own.

An earlier version also carried five gold stars and the Google mark, composed in from
`google-reviews.svg`. Both were removed; the seal is the wreath alone.

## Why there are two files

The lockup is one compound path painted with `currentColor`. Inside an `<img>` there
is nothing to inherit from, so it resolves to black - invisible on a dark page. A
single transparent file cannot serve both themes, and the README pairs them with
`<picture>`:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/awards/product-of-the-day-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/brand/awards/product-of-the-day-light.svg">
  <img src="docs/brand/awards/product-of-the-day-light.svg" alt="Product of the day - 1st" height="74">
</picture>
```

Each `<picture>` is wrapped in a `<p>`. That is not decoration: GitHub passes an HTML
block through verbatim and never wraps one in a paragraph, and `<picture>` is an inline
element - two of them in a row render on the *same line*, whatever blank lines sit
between them in the source.

## What this seal claims

"Product of the day - 1st" is **Flowxtra's**, earned by a shipped product. Tel-Agent is
pre-alpha, has no release, and has not placed anywhere - so on this README the seal
transfers one product's standing onto another. Worth a decision before the repository
gets attention.
