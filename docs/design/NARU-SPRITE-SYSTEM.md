# Naru Sprite System — White Studio Games

Canonical **desk-pet / guide character** art contract for `games.white-studio.org`.

Prompts: [`../prompts/GPT-IMAGE-2-NARU-SPRITES.md`](../prompts/GPT-IMAGE-2-NARU-SPRITES.md)  
Agent skill: [`.cursor/skills/naru-guide/SKILL.md`](../../.cursor/skills/naru-guide/SKILL.md)

Naru is the White Studio Games **arcade floor guide**: a small mascot pet that points, reacts, and coaches without blocking play (open-floor Discord rules still apply).

## Character lock (do not drift)

Canonical art: **`assets/images/naru/_raw/catgirl/`** (see [`NARU-ASSET-MANIFEST.md`](./NARU-ASSET-MANIFEST.md)).

| Trait | Spec |
|-------|------|
| Name | **Naru** |
| Species vibe | Chibi **catgirl** desk pet (nekomimi), original White Studio Games mascot — **not** a real IP |
| Body | Super-deformed: large head, short limbs; readable at **48–96 CSS px** |
| Hair | Long wavy **purple** hair to mid-thigh; black **X** hair clip on bangs (viewer’s right) |
| Ears / tail | Purple cat ears (pale inner fluff); bushy purple tail with **white tip** |
| Outfit | Oversized **black hoodie** (drawstrings), dark purple skirt peek, white loose socks |
| Palette | Purple hair `#6B3FA0`–`#C084FF`, hoodie `#1A1A22`, socks `#F4F0FA`, outline `#1A1224`, cheeks soft pink |
| Forbidden | Photoreal, muddy painterly, text on clothes, weapons, redesigning hairclip/tail tip away |
| Art mode | Clean **pixel art** sprite, hard edges, limited shading |
| Perspective | Front / slight 3/4; feet on shared baseline in each cell |

Always attach `naru-style-anchor-512.png` (catgirl) as Style Lock reference for new sheets.

## Technical sheet format

| Rule | Value |
|------|--------|
| Cell size | **96×96** px (canonical). Runtime may scale with `image-rendering: pixelated` |
| Grid | **8 columns × N rows** |
| Padding | **0** between cells; character centered; **12%** empty margin inside each cell |
| Baseline | Feet / bottom of body sit on **y = 82%** of cell |
| Background | Flat chroma **`#00FF00`** only (Image 2 has no alpha). No floor, no shadow on key |
| Outline | Opaque dark outline; **no** soft outer glow onto green |
| Naming | `naru-{set}-c{cols}r{rows}-96.png` e.g. `naru-core-c8r4-96.png` |
| Site path | `assets/images/naru/` (+ `_raw/` for uncut sheets) |

### Runtime clip formula

```text
frameIndex → col = index % 8, row = floor(index / 8)
background-position: (-col * 96)px (-row * 96)px
background-size: (8 * 96)px (rows * 96)px
```

## Animation sets (v1 — generate these)

Priority order for Codex mass-production. Each set is one sheet unless noted.

### Set A — `core` (required first)

8×4 = **32 frames**. Idle loop + basics for any guide.

| Row | Name | Frames (L→R) | FPS hint | Use |
|-----|------|--------------|----------|-----|
| 0 | `idle` | 8: subtle breathe / ear twitch | 6–8 | Default desk pet |
| 1 | `blink` | 8: eyes open → blink → open (pad last frames with idle) | 10 | Occasional interrupt |
| 2 | `wave` | 8: raise paw, wave, lower | 10 | Hello / after intro |
| 3 | `point_right` | 8: turn slightly, point R, hold, recover | 10 | Point at CTA / cabinet |

### Set B — `guide` (required for onboarding)

8×4 = **32 frames**.

| Row | Name | Use |
|-----|------|-----|
| 0 | `point_left` | Mirror of point_right |
| 1 | `point_up` | Navbar / Discord / language |
| 2 | `point_down` | Leaderboard / scroll / cabinets section |
| 3 | `look_user` | Face camera, attentive (awaiting click) |

### Set C — `react` (feedback)

8×3 = **24 frames**.

| Row | Name | Use |
|-----|------|-----|
| 0 | `celebrate` | Score submit OK / unlock |
| 1 | `think` | Loading / waiting API |
| 2 | `sad` | Soft fail / offline catalog (not scary) |

### Set D — `travel` (optional v1.1)

8×2 = **16 frames**.

| Row | Name | Use |
|-----|------|-----|
| 0 | `walk_right` | Slide pet to target |
| 1 | `walk_left` | Return / reposition |

**v1 ship target:** Sets **A + B + C** (88 frames → 3 sheets). Set D later.

## Guide UX contract (product)

Naru is a **coach**, not a gate:

1. Never blocks play or Discord-optional open floor.
2. Speaks via short i18n bubbles (`naru.tip_*`), not text baked into sprites.
3. Appears after hub intro dismiss (or beside cabinets); can highlight targets with point + CSS spotlight.
4. One tip at a time; dismissible; respect `prefers-reduced-motion` (static frame or slower FPS).
5. New features that need first-run coaching **must** add: tip copy (zh-Hant + en) + preferred anim (`point_*` / `wave` / `celebrate`) + optional target selector.

## Web integration sketch (later implement)

```text
assets/images/naru/
  _raw/naru-core-c8r4-96.png
  naru-core.webp          # post chroma-key atlas
  naru-guide.webp
  naru-react.webp
assets/js/naru-pet.js     # sprite player + tip queue
```

Do **not** implement the pet runtime in the prompt-only phase unless asked.

## QA checklist per sheet

- [ ] Exact 96×96 cells, 8 columns, no gaps
- [ ] Same character proportions as style anchor
- [ ] Pure `#00FF00` background, hard silhouettes
- [ ] No text / logos / watermarks
- [ ] Loop-friendly idle (frame 0 ≈ frame 7)
- [ ] Point gestures read at 48px display size
