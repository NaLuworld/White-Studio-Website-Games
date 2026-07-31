# Naru asset manifest (catgirl)

Canonical ship set: **`_raw/catgirl/`** (Codex / Image 2 handoff, 2026-07-31).

Design contract: [`NARU-SPRITE-SYSTEM.md`](./NARU-SPRITE-SYSTEM.md)  
Prompts: [`../prompts/GPT-IMAGE-2-NARU-SPRITES.md`](../prompts/GPT-IMAGE-2-NARU-SPRITES.md)  
Process: [`../../scripts/process_naru_assets.py`](../../scripts/process_naru_assets.py)

## Canonical files

| Role | Raw (chroma) | Site atlas (alpha) | Size | Frames |
|------|--------------|--------------------|------|--------|
| Style lock | `_raw/catgirl/naru-style-anchor-512.png` | `naru-style-anchor.webp` | 512→cropped | 1 |
| Core A | `_raw/catgirl/naru-core-c8r4-96.png` | `naru-core-c8r4-96.webp` | 768×384 | 8×4=32 |
| Guide B | `_raw/catgirl/naru-guide-c8r4-96.png` | `naru-guide-c8r4-96.webp` | 768×384 | 8×4=32 |
| React C | `_raw/catgirl/naru-react-c8r3-96.png` | `naru-react-c8r3-96.webp` | 768×288 | 8×3=24 |

Older drafts under `_raw/naru-catgirl-*-v*.png` and non-catgirl `_raw/naru-*.png` are **archive only** — do not ship.

## Cell map (96×96, 8 columns)

### `naru-core-c8r4-96`

| Row | Anim | FPS |
|-----|------|-----|
| 0 | `idle` | 6–8 |
| 1 | `blink` | 10 |
| 2 | `wave` | 10 |
| 3 | `point_right` | 10 |

### `naru-guide-c8r4-96`

| Row | Anim | Notes |
|-----|------|-------|
| 0 | `point_left` / forward point | Guide to left UI |
| 1 | `point_up` | Navbar / Discord |
| 2 | `point_down` | Cabinets / scroll |
| 3 | `look_user` / idle attentive | Await click |

### `naru-react-c8r3-96`

| Row | Anim |
|-----|------|
| 0 | `celebrate` |
| 1 | `think` |
| 2 | `sad` / soft idle |

## Runtime clip

```text
cell = 96
cols = 8
background-image: url(/assets/images/naru/naru-core-c8r4-96.webp)
background-size: 768px 384px
background-position: (-col * 96)px (-row * 96)px
```

## Status

| Step | State |
|------|-------|
| Art received (catgirl) | Done |
| Chroma-key atlases | Done (`process_naru_assets.py`) |
| Pet runtime `naru-pet.js` | Done — mount after hub intro |
| Hub mount after intro | Done |
