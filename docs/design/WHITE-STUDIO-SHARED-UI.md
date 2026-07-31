# White Studio Shared UI

Canonical visual contract for **White Studio Games** (`games.white-studio.org`).

## Source of truth

| File | Role |
|------|------|
| [`/assets/css/ws-shared.css`](../../assets/css/ws-shared.css) | Tokens + primitives (buttons, cards, nav, forms, leaderboard, game shell) |
| [`/assets/css/games-chrome.css`](../../assets/css/games-chrome.css) | Arcade lobby + cabinet shell layout |
| This document | Rules for humans and AI agents |

Main-site historical SoT remains in `White-Studio-Website/docs/architecture/THEME-TOKENS.md` (`--ws-*`). Tools uses shorter aliases (`--accent`, `--bg`, `--panel`). **Games ships both**: prefer `--ws-*`, Tools aliases are mapped for prompt compatibility.

## Brand / visual direction

Games is **not** a Tools SaaS clone. Direction:

- **Black-purple neon arcade** floor (dark-first)
- **Pixel display** for Latin titles / HUD labels (`--ws-font-display` = Press Start 2P)
- Body + long Chinese copy stays **Noto Sans TC** / Space Grotesk (`--ws-font-body`)
- Accent remains White Studio purple (`#8a2be2` family) with neon glow tokens (`--ws-neon-glow`)
- Light theme = brighter purple “lightbox”, not flat dashboard white

Brand name is hero-level on the hub. One composition per viewport. Game canvas may use its own palette; chrome (nav, HUD, forms, boards) must use tokens.

## Navbar

- Brand + in-site **Games** only
- Right actions: Discord login, language, theme
- Do **not** put Tools / Community / White Studio in the top nav
- Cross-product links belong in a future **About** surface (see architecture doc)

## Theme

- `html[data-theme="dark"|"light"]`
- Boot with `/assets/js/theme-boot.js` before paint
- Storage key: `localStorage["ws_games_theme_v1"]` (reads legacy `theme-mode` too)
- Controls: `.ws-theme-btn` via `/assets/js/site-chrome.js`

## Language

- Locales: `zh-Hant` (default) + `en`
- Handwritten dictionaries in `/assets/i18n/*.json` — see [`docs/i18n/GAMES-I18N.md`](../i18n/GAMES-I18N.md)
- Storage key: `localStorage["ws_games_lang_v1"]`
- Do not use Tools `auto-i18n.js`

## Identity (Discord) — open floor

- Anyone can browse cabinets, play, and submit guest scores without Discord
- Navbar Discord login talks to `https://api.white-studio.org` (`/auth/games/discord/start`, `/api/games/session`)
- Cookie: `ws_games_session` (open identity; **not** Tools admin allowlist)
- User payload shape matches Tools for future family-bucket joins: `discordUserId`, `username`, `displayName`, `avatarUrl`
- Leaderboard scores remain guest `playerName` for now

## Tokens (use these)

Surfaces: `--ws-bg-page`, `--ws-bg-surface`, `--ws-bg-card`, `--ws-bg-input`  
Text: `--ws-text-primary`, `--ws-text-muted`  
Border / focus: `--ws-border-subtle`, `--ws-border-focus`, `--ws-border-strong`  
Accent / neon: `--ws-accent`, `--ws-accent-2`, `--ws-accent-soft`, `--ws-neon-glow`, `--ws-neon-glow-strong`  
Fonts: `--ws-font-body`, `--ws-font-display`  
Radius: `--ws-radius-sm|md|lg|pill`  
Shadow: `--ws-shadow-sm|md|card|lg`

Aliases: `--bg`, `--panel`, `--text`, `--muted`, `--border`, `--accent`, `--accent-2`

## Components

| Class | Use |
|-------|-----|
| `.ws-site-header` / `.ws-brand` / `.ws-nav` / `.ws-site-header__actions` | Top chrome |
| `.ws-i18n-btn` / `.ws-theme-btn` / `.ws-auth-login` | Language, theme, Discord login |
| `.ws-button` + `--primary` / `--ghost` | Actions |
| `.ws-card` / `.arcade-cabinet` | Interactive cabinet cards only |
| `.arcade-hero` / `.ws-section` | Hub copy |
| `.ws-input` / `.ws-field` | Forms |
| `.ws-leaderboard` / `.arcade-board` | Rank table |
| `.ws-game-stage` / `.ws-game-hud` / `.arcade-hud` | Play shell |

## Motion

Ship intentional arcade motion (respect `prefers-reduced-motion`):

1. Ambient floor scanline / grid (`.games-page` pseudo-elements)
2. Hero eyebrow glow pulse
3. Primary CTA / neon pulse; cabinet hover neon lift

## Do

- Link `ws-shared.css` + `games-chrome.css` on every Games page
- Boot chrome with `WhiteStudioGames.bootChrome()` after loading `i18n.js` + `games-auth.js` + `site-chrome.js`
- Keep game stage full-bleed inside `.ws-game-stage`
- Call `https://api.white-studio.org` via `WhiteStudioGames.createGamesApi()` / Games Discord auth client

## Do not

- Hard-code brand purple / page background hex in new chrome CSS (prefer tokens)
- Depend on Tailwind CDN for Games
- Reuse Tools Discord admin session (`ws_tools_session`) for player scores
- Put cross-site Tools/Community/Studio links back in the navbar
- Gate play behind Discord login
- Put scores in GitHub JSON / short-links
- Ship dashboard card grids in the hub hero
- Introduce machine-translation i18n

## Migration note

Main site and Tools are **not** rewritten in this pass. Copy `ws-shared.css` forward when those repos are ready to converge — Games arcade direction may stay Games-specific.
