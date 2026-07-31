# GPT Image 2 — White Studio Games arcade assets

Paste these prompts into **ChatGPT Plus** (GPT Image 2 / image generation).  
Do **not** change the Style Lock between shots unless A1 itself is rejected.

Contract: [`../design/WHITE-STUDIO-SHARED-UI.md`](../design/WHITE-STUDIO-SHARED-UI.md)  
Manifest + handoff: [`../design/ARCADE-ASSET-MANIFEST.md`](../design/ARCADE-ASSET-MANIFEST.md)

Official notes: Image 2 supports flexible sizes (e.g. 3840×2160, 2160×3840) within API limits. **Transparent background is not supported** on `gpt-image-2` — use chroma-key for cutouts.

---

## Workflow (exact order)

1. Generate **Prompt A1** → save as `arcade-style-anchor-2048.png`. Freeze this file.
2. Generate **Prompt A2** with **A1 attached** as reference image.
3. Generate **Prompt A4** with **A1 attached** as reference image.
4. Generate **Prompt A3** with **A1 attached** (and optionally **A2** as family layout reference). Force **new composition**, not a crop.
5. Run QA from the manifest handoff checklist; then return the four files for site implementation.

**ChatGPT UI tips**

- Set size / aspect explicitly in the prompt **and** in the size picker when available.
- Quality: **high** for finals.
- One image per request; iterate with the Fix prompts below instead of rewriting Style Lock.

---

## Style Lock (immutable — paste above every prompt)

```text
STYLE LOCK — White Studio Games arcade (do not deviate)

Brand world: quiet 1990s Japanese indoor arcade × clean black-purple futurism.
Not cyberpunk alley, not rainy neon street, not cluttered signage wall.

Color area mix (approximate):
- ~70% deep black-purple void: #07060C, #100E18
- ~20% structure / reflection: #2A2438, #5B21B6
- ~8% brand neon: #8A2BE2, #C084FF
- ≤2% cool cyan accents only: #62E7FF (tiny screen / LED ticks)
Forbidden as primary: red, orange, hot pink, teal-green washes.

Materials: matte fog-black metal, smoked glass, deep-purple acrylic, thin chrome trim.
Lighting: low key, soft volumetric purple bloom, controlled speculars, no harsh white flood.
Camera: cinematic concept art / high-end 3D still; sharp but not clinical product photo.
Pixel cues: ONLY subtle pixel glow on CRT-like screen content and tiny floor glyphs — do NOT pixelate the whole image.

Cabinet language (when a cabinet appears):
- Upright cabinet silhouette, width:height ≈ 0.48:1
- Screen ≈ 28% of cabinet height, control deck ≈ 16%, pedestal/base ≈ 42%
- Tight rounded corners; readable at thumbnail size
- Same fictional “White Studio” machine family across all shots (no real brand IP)

Hard bans for ALL images:
- No text, letters, numbers, logos, watermarks, UI, HUD, buttons, menus
- No humans, mascots, hands, or faces as subjects
- No known games / franchises / trademarked cabinet art
- No dirty floors, trash, graffiti, rain, outdoor cityscapes
- No fake “White Studio” lettering rendered in-image

Output: opaque RGB image only (no alpha). Follow the shot-specific size and safe zones exactly.
```

---

## Prompt A1 — Style anchor

**Filename:** `arcade-style-anchor-2048.png`  
**Size:** `2048x2048` (1:1)  
**Refs:** none  
**Site use:** style lock only (not published)

```text
[PASTE STYLE LOCK HERE]

SHOT A1 — STYLE ANCHOR, 2048×2048 square

Create a single centered upright arcade cabinet in three-quarter view on a nearly empty black-purple arcade floor.
Show just enough environment to read materials: reflective dark floor, soft fog, distant muted wall.
The cabinet is the hero; keep background simple and clean.

Composition:
- Cabinet fills ~55–65% of frame height, centered
- Slight 3/4 angle, pedestal fully visible
- Soft purple rim light; tiny cyan LED ticks only (≤2% of frame)
- Screen shows abstract purple neon motion / soft pixel glow — still NO readable text

This image defines materials, color temperature, and cabinet silhouette for later shots.
Do not add extra cabinets, posters, or clutter.
```

**Accept A1 if:** color mix feels right; silhouette is clean; no text; materials match Style Lock.

---

## Prompt A2 — Desktop lobby hero

**Filename:** `arcade-lobby-desktop-3840x2160.png`  
**Size:** `3840x2160` (16:9)  
**Refs:** attach **A1**  
**Site use:** PC / wide hero background

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Match the attached style-anchor image for cabinet design, materials, and color temperature. Same machine family.

SHOT A2 — DESKTOP LOBBY BACKGROUND, exactly 3840×2160 (16:9 landscape)

Wide cinematic view of a clean indoor White Studio arcade floor at night lighting.
One primary matching cabinet as the right-side hero; optional very soft secondary cabinets far in the background (out of focus, no new designs).

SAFE ZONES (must obey):
- Left 0–44% of width: low detail, low contrast — reserved for website title/copy overlay. No bright neon clusters, no cabinet body.
- Top 0–14% of height: keep calm for site navbar — no bright marquee, no cabinet crown.
- Primary cabinet + perspective focus: roughly 58–86% across the width, mid vertical.
- Keep ~3% edge margin free of critical detail.

Mood: inviting open arcade floor, spacious, premium, quiet neon — not crowded.
Still NO text, logos, UI, people, or outdoor city.

Match A1 cabinet proportions and materials exactly.
```

**Accept A2 if:** left third is copy-safe; top strip is quiet; cabinet family matches A1.

---

## Prompt A3 — Mobile lobby hero

**Filename:** `arcade-lobby-mobile-2160x3840.png`  
**Size:** `2160x3840` (9:16)  
**Refs:** attach **A1** (required); optionally attach **A2** as “same world / do not crop”  
**Site use:** mobile-only background via `<picture>`

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Match the style-anchor cabinet, materials, and color temperature.
If a desktop lobby image is also attached: keep the SAME world and machine family, but RECOMPOSE for portrait — do NOT crop or stretch the landscape image.

SHOT A3 — MOBILE LOBBY BACKGROUND, exactly 2160×3840 (9:16 portrait)

Vertical arcade lobby still for a phone hero. Same clean black-purple White Studio floor.

SAFE ZONES (must obey):
- Top 0–38% of height: copy-safe — soft ceiling space, gentle fog, minimal contrast. No cabinet, no bright neon blobs.
- Left/right 8% margins: no critical silhouette flush to edges (phone crop).
- Cabinet body: centered, occupying roughly 45–82% of height.
- Bottom 12%: no important geometry (home indicator / footer clear).

One primary cabinet only (matching A1). Spacious, vertical, premium.
NO text, logos, UI, people, outdoor streets.
```

**Accept A3 if:** top is empty enough for copy; cabinet sits mid-lower; clearly not a cropped A2.

---

## Prompt A4 — Cabinet chroma-key

**Filename:** `arcade-cabinet-key-1536x2048.png`  
**Size:** `1536x2048` (~3:4)  
**Refs:** attach **A1**  
**Site use:** after green removal → card / foreground WebP

```text
[PASTE STYLE LOCK HERE]

REFERENCE: Match the attached style-anchor cabinet silhouette, proportions, materials, and neon language exactly.

SHOT A4 — SINGLE CABINET CUTOUT PLATE, exactly 1536×2048

Full upright arcade cabinet, three-quarter view, same family as A1.
Background MUST be a flat solid chroma-key green fill #00FF00 with ZERO gradient, ZERO floor, ZERO shadow on the key, ZERO environment.

Cutout rules for Image 2 (no true transparency available):
- Hard, clean silhouette against #00FF00
- NO soft outer glow, NO bloom bleeding onto the green
- NO semi-transparent edges
- Keep speculars ON the cabinet body only
- Screen may have internal purple/cyan glow that stays INSIDE the bezel

Proportions: width:height ≈ 0.48:1; screen ~28% / deck ~16% / base ~42% of cabinet height.
Center the cabinet; leave green padding around it (~8–12% of frame).

NO text, logos, UI, people, second cabinets, or props.
```

**Accept A4 if:** green is pure and flat; edges are hard; cabinet matches A1; usable for chroma remove.

**Post (implementation phase):** remove `#00FF00` → alpha; add neon glow in CSS (`box-shadow` / filter), not in the bitmap.

---

## Fix prompts (iterate without rewriting Style Lock)

Use only one issue class per retry. Always re-attach A1 (and the failed image if editing).

### Fix — safe zone violation

```text
Using the same Style Lock and the attached reference(s), regenerate this shot.
Keep materials and cabinet family identical.
ONLY change composition to restore safe zones:
[paste the SAFE ZONES block from A2 or A3]
Do not add new objects, text, or color shifts.
```

### Fix — color drift

```text
Regenerate with identical composition intent.
Restore the Style Lock color mix: ~70% #07060C/#100E18, ~20% #2A2438/#5B21B6, ~8% #8A2BE2/#C084FF, ≤2% #62E7FF.
Remove red/orange/pink/teal dominance. Keep cabinet design unchanged.
```

### Fix — cabinet proportions

```text
Keep scene and lighting family the same.
Correct the cabinet to width:height ≈ 0.48:1 with screen ~28%, control deck ~16%, base ~42% of cabinet height.
Match the style-anchor silhouette more closely. No text.
```

### Fix — too much detail / clutter

```text
Simplify: remove extra cabinets, posters, props, and busy neon.
Keep one hero cabinet and a clean floor. Preserve safe zones and Style Lock colors.
```

### Fix — A4 green bleed / soft edge

```text
Regenerate the chroma-key cabinet plate.
Background must be flat #00FF00 only.
Hard silhouette, no outer glow onto the green, no floor shadow, no semi-transparent fringe.
Internal screen glow stays inside the bezel.
```

---

## Codex / agent import blurb (optional)

If you hand this pack to Codex for further planning (not generation), paste:

```text
Repo: NaLuworld/White-Studio-Website-Games
Read: docs/design/WHITE-STUDIO-SHARED-UI.md
      docs/design/ARCADE-ASSET-MANIFEST.md
      docs/prompts/GPT-IMAGE-2-ARCADE-ASSETS.md
Phase: assets defined; wait for four returned PNGs; then implement responsive <picture> + chroma-key cabinet + WebP budgets. Do not invent alternate art styles.
```

---

## After generation

1. Rename files exactly as in the manifest.
2. Tick the **Handoff checklist** in `ARCADE-ASSET-MANIFEST.md`.
3. Return the four PNGs (or a zip) to the site agent for QA + wiring.
4. Do **not** ask the site agent to restyle from scratch if Style Lock was followed — only fix QA failures.
