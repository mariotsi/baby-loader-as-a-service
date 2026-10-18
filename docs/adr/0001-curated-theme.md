# Themes come from curated Palettes and Fonts, never custom CSS

An Owner customises a Site by picking one Palette and one Font from the Platform's curated lists in `src/lib/theme.ts`, applied as CSS custom properties; there is no free-form CSS or arbitrary font. This keeps every Public page fast, safe to render, and cheap to serve, at the cost of Owners never getting pixel-level control.

## Consequences

- Taking free-form CSS back after Owners rely on it would break their Sites, so this stays a one-way door.
- The design system ([#3](https://github.com/mariotsi/baby-loader-as-a-service/issues/3)) is specified on top of this: each Palette sets the color tokens and each Font the typography tokens.
