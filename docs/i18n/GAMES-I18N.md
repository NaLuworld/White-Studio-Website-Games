# Games i18n (handwritten dictionaries)

Canonical bilingual contract for **White Studio Games** (`games.white-studio.org`).

Locales: **`zh-Hant`** (default) and **`en`** only.  
Do **not** port Tools `auto-i18n.js` or machine-translation pipelines.

## Source of truth

| File | Role |
|------|------|
| [`/assets/i18n/zh-Hant.json`](../../assets/i18n/zh-Hant.json) | Traditional Chinese strings |
| [`/assets/i18n/en.json`](../../assets/i18n/en.json) | English strings |
| [`/assets/js/i18n.js`](../../assets/js/i18n.js) | Runtime apply + language switcher |
| This document | Rules for humans and AI agents |

Storage key: `localStorage["ws_games_lang_v1"]`  
HTML: `document.documentElement.lang` synced to the active locale.

## Key rules

1. Keys use `section.snake_case` (e.g. `nav.games`, `demo.overlay_body`).
2. Every new visible string needs the **same key in both JSON files**.
3. Prefer HTML `data-i18n="key"` for static copy.
4. Attributes: `data-i18n-attr="placeholder:demo.nickname_ph"` or `data-i18n-attr="aria-label:brand.home_aria"`.
5. JS dynamic strings: `WhiteStudioI18n.t("key")` or `t("key", { name: "…" })` with `{name}` placeholders.
6. Proper nouns may stay identical in both locales (`Discord`, `White Studio`, `Neon Runner`).
7. Never hard-code user-facing chrome copy in new pages without a dictionary entry.

## Agent checklist (add / change copy)

When adding a game page, HUD label, footer line, toast, or form label:

1. Add the key to **both** `zh-Hant.json` and `en.json`.
2. Wire the DOM with `data-i18n` / `data-i18n-attr`, or call `t()` in JS.
3. Keep zh-Hant as the authoring source of truth when unsure.
4. Update this doc only if key naming conventions change.
5. Update [`docs/prompts/ADD-GAME-TO-GAMES-PLATFORM.md`](../prompts/ADD-GAME-TO-GAMES-PLATFORM.md) checklist if the add-game flow changes.

## Hub intro keys

Hub-only entrance overlay (`#arcade-intro` on `/` only): `intro.aria`, `intro.title`, `intro.lede`, `intro.hint`.  
Not used on game pages. Plays on every hub load; no Play gate.

## Naru desk-pet keys

Hub guide pet (`WhiteStudioNaru`): `naru.aria`, `naru.dismiss`, `naru.tip_welcome`, `naru.tip_cabinets`, `naru.tip_discord`.  
Tips run once per browser (`localStorage.ws_naru_tips_v1`); pet still idles after every intro.

## Forbidden

- Introducing Tools `auto-i18n.js` / translation cache APIs
- Adding ja / ko / zh-CN without an explicit product decision
- Leaving a key in only one locale file
- Translating inside CSS content strings

## Related identity note

Discord session copy (`auth.*`) is bilingual UI only. The identity payload from `api.white-studio.org` (`discordUserId`, `username`, `displayName`, `avatarUrl`) is language-agnostic and shared across White Studio products for future family-bucket joins.
