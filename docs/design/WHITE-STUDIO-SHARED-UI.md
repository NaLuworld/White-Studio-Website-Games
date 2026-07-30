# White Studio Shared UI

Canonical visual contract for **White Studio Games** (`games.white-studio.org`), designed to align with `white-studio.org` and `tools.white-studio.org` without requiring those sites to migrate in this release.

## Source of truth

| File | Role |
|------|------|
| [`/assets/css/ws-shared.css`](../../assets/css/ws-shared.css) | Tokens + primitives (buttons, cards, nav, forms, leaderboard, game shell) |
| [`/assets/css/games-chrome.css`](../../assets/css/games-chrome.css) | Games platform layout only |
| This document | Rules for humans and AI agents |

Main-site historical SoT remains in `White-Studio-Website/docs/architecture/THEME-TOKENS.md` (`--ws-*`). Tools uses shorter aliases (`--accent`, `--bg`, `--panel`). **Games ships both**: prefer `--ws-*`, Tools aliases are mapped for prompt compatibility.

## Brand

- Dark-first community gaming shell: page `#0f0f10`, accent `#8a2be2`
- Font stack: **Space Grotesk + Noto Sans TC** (Games / shared shell). Main site still uses Inter — gradual dual-load is fine when migrating.
- One composition per viewport; brand name is hero-level on the hub.
- Game canvas may use its own palette; chrome (nav, HUD labels, forms, boards) must use tokens.

## Theme

- `html[data-theme="dark"|"light"]`
- Boot with `/assets/js/theme-boot.js` before paint
- Storage key: `localStorage["ws_games_theme_v1"]` (reads legacy `theme-mode` too)
- Controls: Tools-style `.ws-theme-btn` via `/assets/js/site-chrome.js`

## Language

- Locales: `zh-Hant` (default) + `en`
- Handwritten dictionaries in `/assets/i18n/*.json` — see [`docs/i18n/GAMES-I18N.md`](../i18n/GAMES-I18N.md)
- Storage key: `localStorage["ws_games_lang_v1"]`
- Do not use Tools `auto-i18n.js`

## Identity (Discord)

- Navbar Discord login talks to `https://api.white-studio.org` (`/auth/games/discord/start`, `/api/games/session`)
- Cookie: `ws_games_session` (open identity; not Tools admin allowlist)
- User payload shape matches Tools for future family-bucket joins: `discordUserId`, `username`, `displayName`, `avatarUrl`
- Stable join key across White Studio products: **`discordUserId`**
- Leaderboard scores remain guest `playerName` for now

## Tokens (use these)

Surfaces: `--ws-bg-page`, `--ws-bg-surface`, `--ws-bg-card`, `--ws-bg-input`  
Text: `--ws-text-primary`, `--ws-text-muted`  
Border / focus: `--ws-border-subtle`, `--ws-border-focus`  
Accent: `--ws-accent`, `--ws-accent-2`, `--ws-accent-soft`  
Radius: `--ws-radius-sm|md|lg|pill`  
Shadow: `--ws-shadow-sm|md|card|lg`

Aliases: `--bg`, `--panel`, `--text`, `--muted`, `--border`, `--accent`, `--accent-2`

## Components

| Class | Use |
|-------|-----|
| `.ws-site-header` / `.ws-brand` / `.ws-nav` / `.ws-site-header__actions` | Top chrome |
| `.ws-i18n-btn` / `.ws-theme-btn` / `.ws-auth-login` | Language, theme, Discord login |
| `.ws-button` + `--primary` / `--ghost` | Actions |
| `.ws-card` | Interactive catalog cards only |
| `.ws-hero` / `.ws-section` | Hub copy |
| `.ws-input` / `.ws-field` | Forms |
| `.ws-leaderboard` | Rank table |
| `.ws-game-stage` / `.ws-game-hud` | Play shell |

## Do

- Link `ws-shared.css` on every Games page
- Boot chrome with `WhiteStudioGames.bootChrome()` after loading `i18n.js` + `games-auth.js` + `site-chrome.js`
- Keep game stage full-bleed inside `.ws-game-stage`
- Call `https://api.white-studio.org` via `WhiteStudioGames.createGamesApi()` / Games Discord auth client

## Do not

- Hard-code brand purple / page background hex in new chrome CSS
- Depend on Tailwind CDN for Games
- Reuse Tools Discord admin session (`ws_tools_session`) for player scores
- Put scores in GitHub JSON / short-links
- Ship dashboard card grids in the hub hero
- Introduce machine-translation i18n

## Migration note

Main site and Tools are **not** rewritten in this pass. Copy `ws-shared.css` forward when those repos are ready to converge.
