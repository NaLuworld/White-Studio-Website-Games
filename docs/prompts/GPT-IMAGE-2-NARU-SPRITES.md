# GPT Image 2 / Codex — Naru sprite sheets (Games style)

Paste into **ChatGPT Plus / Codex image gen**. Always attach the **Naru style-anchor** (Codex pet sprite or first approved frame) as reference.

System contract: [`../design/NARU-SPRITE-SYSTEM.md`](../design/NARU-SPRITE-SYSTEM.md)

**Image 2 note:** no transparent PNG — use flat `#00FF00` chroma. Post-process like arcade cabinet key.

---

## Style Lock (immutable — paste above every prompt)

```text
STYLE LOCK — Naru, White Studio Games desk-pet sprite (catgirl)

Character: Naru — cute chibi catgirl (nekomimi) studio mascot (original, not any real IP).
Long wavy purple hair, purple cat ears with pale inner fluff, bushy purple tail with white tip,
small black X hair clip on bangs, oversized black hoodie with drawstrings, short dark purple skirt,
white loose socks, large purple eyes, soft smile, chibi proportions (big head, small body).
Art style: clean 2D pixel art game sprite, limited palette, hard edges, dark outline,
readable at 48–96px. Not photoreal, not painterly, not 3D.

Sheet rules (MANDATORY):
- Perfect regular grid of equal cells
- Each cell exactly 96×96 logical pixels
- 8 columns; character centered in every cell
- Feet on a consistent baseline (~82% down the cell)
- Flat solid chroma-key background #00FF00 ONLY — no floor, no shadow on green, no glow bleeding onto green
- Same character design, proportions, outline weight, hairclip, and white tail tip in EVERY cell
- NO text, letters, numbers, logos, UI, speech bubbles, watermarks

Match the attached Naru style-anchor (catgirl) exactly for face, hair, ears, hoodie, and colors.
```

### Recommended sheet pixel sizes

| Sheet | Grid | Image size |
|-------|------|------------|
| core / guide | 8×4 | **768×384** |
| react | 8×3 | **768×288** |
| travel | 8×2 | **768×192** |
| style anchor | 1×1 | **512×512** (single pose on green) |

If the model drifts on grid: ask for **one row at a time** (8×1 = **768×96**) using the Row prompts below, then stitch in code/`process` later.

---

## Prompt 0 — Style anchor (do first)

**File:** `naru-style-anchor-512.png`  
**Size:** `512x512`  
**Refs:** user’s Codex pet sprite if available

```text
[PASTE STYLE LOCK HERE]

SHOT — NARU STYLE ANCHOR, 512×512

Single full-body Naru, front three-quarter view, standing idle, friendly calm expression.
Centered in frame with green #00FF00 chroma background only.
No other objects. This image locks face, ears, body proportions, outline, and colors for all later sprite sheets.
```

---

## Prompt A — Core sheet (idle / blink / wave / point_right)

**File:** `naru-core-c8r4-96.png`  
**Size:** `768x384`  
**Refs:** style anchor

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Match attached Naru style-anchor exactly.

SPRITE SHEET — 8 columns × 4 rows, each cell identical size (96×96 logical), full image 768×384.
Background entirely flat #00FF00. Tight grid, no gutters, no labels, no numbers.

Row 0 (top): IDLE loop — 8 frames subtle breathing and tiny ear twitch; loopable (frame0 ≈ frame7).
Row 1: BLINK — eyes open, half-close, closed, half-open, open; remaining frames hold idle.
Row 2: WAVE — raise right paw, wave twice, return to idle.
Row 3: POINT RIGHT — turn slightly right, extend paw pointing right, hold, return.

Keep Naru fully inside each cell with ~12% margin. Feet on shared baseline across all cells.
```

---

## Prompt B — Guide sheet (point L/U/D + look)

**File:** `naru-guide-c8r4-96.png`  
**Size:** `768x384`  
**Refs:** style anchor (+ core sheet optional)

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Same Naru as attached style-anchor / core sheet.

SPRITE SHEET — 8×4 cells, 768×384, flat #00FF00, no text.

Row 0: POINT LEFT — mirror of point-right, clear leftward gesture.
Row 1: POINT UP — paw / gaze upward (for navbar cues).
Row 2: POINT DOWN — paw / gaze downward (for scroll / cabinets).
Row 3: LOOK AT USER — face camera, attentive, slight lean forward; 8-frame micro-idle.

Consistent proportions and baseline. Hard silhouettes on green.
```

---

## Prompt C — React sheet

**File:** `naru-react-c8r3-96.png`  
**Size:** `768x288`  
**Refs:** style anchor

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Same Naru as attached style-anchor.

SPRITE SHEET — 8×3 cells, 768×288, flat #00FF00, no text.

Row 0: CELEBRATE — happy bounce / sparkle ticks (cyan tiny only), loopable joy.
Row 1: THINK — paw to chin or tilted head, soft loading vibe; no props with text.
Row 2: SAD — mild droop ears, gentle (not crying heavily); suitable for soft error UI.

Same body lock, baseline, hard edges on green.
```

---

## Prompt D — Travel sheet (optional)

**File:** `naru-travel-c8r2-96.png`  
**Size:** `768x192`

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Same Naru as attached style-anchor.

SPRITE SHEET — 8×2 cells, 768×192, flat #00FF00.

Row 0: WALK RIGHT — 8-frame cycle, side/three-quarter, loopable.
Row 1: WALK LEFT — mirrored walk cycle, same proportions.
```

---

## Row-at-a-time fallback (if grid fails)

```text
[PASTE STYLE LOCK HERE]
REFERENCE: attached Naru style-anchor.

ONE STRIP ONLY: 8 frames in a single horizontal row, image exactly 768×96.
Flat #00FF00 background. Equal 96×96 cells, no gaps.
Animation: [IDLE | BLINK | WAVE | POINT_RIGHT | … specify one]
```

Then stitch rows with a local script into `c8rN` sheets.

---

## Fix prompts

### Fix — broken grid

```text
Regenerate the same sheet. Enforce a perfect 8-column grid of equal square cells, no overlaps, no uneven spacing, no rotated cells. Keep Naru identical to the style-anchor. Background pure #00FF00.
```

### Fix — character drift

```text
Match the attached style-anchor face, ear shape, outline weight, and cream/purple palette exactly. Do not redesign Naru. Only fix the animation frames requested.
```

### Fix — green bleed

```text
Hard silhouette against flat #00FF00. No soft glow, no anti-aliased green fringe, no floor shadow. Internal purple highlights stay inside the outline.
```

---

## After generation (handoff)

1. Save raw sheets under `assets/images/naru/_raw/`.
2. Chroma-key → WebP atlases (reuse approach from `scripts/process_arcade_assets.py`).
3. Register frame ranges in future `naru-pet.js` / manifest.
4. Tip strings go in `assets/i18n/*.json` as `naru.*` — never painted on sprites.

## Codex agent blurb

```text
Repo: NaLuworld/White-Studio-Website-Games
Read: docs/design/NARU-SPRITE-SYSTEM.md
      docs/prompts/GPT-IMAGE-2-NARU-SPRITES.md
      .cursor/skills/naru-guide/SKILL.md
When adding user-facing flows, if first-run coaching helps, implement Naru tip + anim (do not skip). Generate missing sprite rows with Style Lock before inventing a new mascot.
```
