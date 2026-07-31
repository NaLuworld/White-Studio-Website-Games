# Social cards (Open Graph / Twitter)

Share previews for `games.white-studio.org`. Crawlers read **static** `<meta>` tags — do not rely on JS i18n for OG/Twitter.

## Layout (1200×630)

| Region | Role |
|--------|------|
| Top-left | White Studio mark + site name |
| Left square | **Game logo / icon slot** (`assets/images/games/<id>/icon.png`) |
| Right copy | Title, optional EN subtitle, short description |
| Bottom | Absolute host + path |

Snake temporarily fills the icon slot with cabinet art. Swap `icon.png` later without changing meta URLs.

## Files

| Path | Purpose |
|------|---------|
| [`assets/images/og/manifest.json`](../../assets/images/og/manifest.json) | Hub + game titles, descriptions, icon paths |
| [`assets/images/og/<id>.png`](../../assets/images/og/) (+ `.jpg`) | Composed cards |
| [`assets/images/games/<id>/icon.png`](../../assets/images/games/) | Per-game logo/icon |
| [`scripts/compose_og_cards.py`](../../scripts/compose_og_cards.py) | Regenerates all cards from the manifest |

## Required `<head>` on every shareable page

Use absolute HTTPS URLs (`https://games.white-studio.org/...`).

```html
<link rel="canonical" href="https://games.white-studio.org/games/<game-id>/" />
<meta name="description" content="..." />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="White Studio Games" />
<meta property="og:url" content="https://games.white-studio.org/games/<game-id>/" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="https://games.white-studio.org/assets/images/og/<game-id>.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="..." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="https://games.white-studio.org/assets/images/og/<game-id>.png" />
```

Hub uses `og/hub.png` and canonical `/`.

## Adding a new game

1. Drop `assets/images/games/<game-id>/icon.png` (cabinet placeholder OK).
2. Append an entry to `assets/images/og/manifest.json`.
3. Run `python scripts/compose_og_cards.py`.
4. Copy the meta block into `games/<game-id>/index.html` (pointing at `og/<game-id>.png`).
5. Deploy Pages; validate with [Twitter Card Validator](https://cards-dev.twitter.com/validator) / opengraph.xyz.
