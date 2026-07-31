# Game icons

Square logo / icon per game. Used by:

- Open Graph / Twitter Card composition (`scripts/compose_og_cards.py`)
- Optional future UI (favicons, cabinet badges)

## Path

```text
assets/images/games/<game-id>/icon.png
```

Preferred: **1024×1024** PNG (transparent OK). Temporary art is fine — Snake currently uses the arcade cabinet as a stand-in.

When you replace `icon.png`, re-run:

```bash
python scripts/compose_og_cards.py
```

and keep the meta `og:image` / `twitter:image` URL the same (`/assets/images/og/<game-id>.png`).
