---
name: naru-guide
description: >-
  White Studio Games desk-pet guide Naru — sprite sheets, tip UX, and Image 2
  production prompts. Use when adding onboarding, feature coaching, arcade hub
  tips, Naru animations, sprite atlases, or when the user mentions Naru, 桌寵,
  sprite, or character guide on games.white-studio.org.
---

# Naru guide (Games desk pet)

## When this skill applies

Use whenever you:

- Add a **new user-facing flow** on Games that benefits from first-run coaching
- Touch hub intro, cabinets, Discord login UX, leaderboard submit, or empty states
- Generate or crop **Naru sprites** / atlases
- The user says **Naru**, **桌寵**, **sprite**, or **角色引導**

## Mandatory product rule

If a new feature needs guidance, **do not ship tip-less UI by default**. Prefer:

1. Short bilingual tip keys `naru.tip_*` in `assets/i18n/zh-Hant.json` + `en.json`
2. A Naru anim from the sprite system (`idle` / `wave` / `point_*` / `celebrate` / `think` / `sad`)
3. Optional CSS highlight on the target control

Naru **never** blocks play or forces Discord login (open-floor rule).

## Source of truth

| Doc | Role |
|-----|------|
| [`docs/design/NARU-SPRITE-SYSTEM.md`](../../../docs/design/NARU-SPRITE-SYSTEM.md) | Character lock, grids, sets A–D, QA |
| [`docs/design/NARU-ASSET-MANIFEST.md`](../../../docs/design/NARU-ASSET-MANIFEST.md) | Canonical catgirl sheets + atlas paths |
| [`docs/prompts/GPT-IMAGE-2-NARU-SPRITES.md`](../../../docs/prompts/GPT-IMAGE-2-NARU-SPRITES.md) | Style Lock + sheet prompts for Codex / Image 2 |
| [`docs/design/WHITE-STUDIO-SHARED-UI.md`](../../../docs/design/WHITE-STUDIO-SHARED-UI.md) | Arcade chrome tokens |

## Sprite production checklist

1. Lock **style anchor** first (`naru-style-anchor-512.png`) from user’s Codex pet if provided.
2. Generate sheets in order: **core → guide → react** (travel optional).
3. Grid: **96×96 cells**, **8 columns**, chroma `#00FF00`, hard edges.
4. If the model breaks grids, generate **8×1 strips (768×96)** and stitch.
5. Store raw under `assets/images/naru/_raw/`; ship keyed WebP atlases only.
6. Never bake speech text into pixels — tips are HTML/i18n.

## Guide implementation checklist (runtime)

When implementing Naru UI (separate from art gen):

- [ ] Mount after hub intro dismiss (or on target page)
- [ ] `image-rendering: pixelated` (or crisp-edges) on atlas
- [ ] Tip bubble uses i18n; one tip queue; dismissible
- [ ] `prefers-reduced-motion`: freeze on a single frame or very low FPS
- [ ] Point anim matches tip target (left/right/up/down)
- [ ] z-index below modal dialogs, above decorative hero art as needed
- [ ] Document new `naru.tip_*` keys in both locale files

## Prompt reminder for the user

When asking the user / Codex to draw sprites, point them at:

`docs/prompts/GPT-IMAGE-2-NARU-SPRITES.md`

Require Style Lock + style-anchor attachment on every batch.
