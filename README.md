# How Long to Clear ⏱️

A progressive web app that cross-references your [Steam](https://store.steampowered.com) wishlist with [HowLongToBeat](https://howlongtobeat.com) data to help you decide what to play next depending on your time and budget. Built with Antigravity.

Try it at [t0mg.github.io/howlong](https://t0mg.github.io/howlong)

## Features

- 🎮 **Fetch your full Steam wishlist** by entering your Steam64 ID
- ⏱️ **HowLongToBeat integration** — main story, main+extras, and completionist times for each game
- 💰 **Live pricing** — current prices, discounts, and sale badges
- 📊 **Sort & analyze** — sort by duration, price, discount, priority, or name
- 📈 **Aggregate stats** — total wishlist hours, total value, and total potential savings
- 📱 **Installable PWA** — works offline and can be added to your home screen
- 🌙 **Premium dark theme** with glassmorphism and smooth animations for that classic Vibe Coded feel

## Prerequisites

- **Public Steam profile** — your Steam profile and wishlist must be set to Public in [Steam Privacy Settings](https://steamcommunity.com/my/edit/settings)
- **Steam64 ID** — find yours at [steamid.io](https://steamid.io)
- **Cloudflare Worker proxy** — both Steam and HLTB block browser CORS requests. A lightweight proxy is included in the `worker/` directory.

## Quick Start

### 1. Deploy the Proxy (Cloudflare Worker)

The `worker/` directory contains a Cloudflare Worker that proxies requests to Steam and HowLongToBeat. You need a free [Cloudflare](https://dash.cloudflare.com/sign-up) account.

```bash
cd worker
npm install
npx wrangler login     # authenticate with Cloudflare
npx wrangler deploy    # deploys the worker
```

Note the deployed URL (e.g., `https://howlong-proxy.your-subdomain.workers.dev`).

### 2. Configure the Proxy URL

Create a `.env` file in the project root:

```env
VITE_PROXY_BASE=https://howlong-proxy.your-subdomain.workers.dev
```

Or update the default in `src/api/config.ts`.

### 3. Run Locally

```bash
npm install
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

Output is in the `dist/` directory.

## Deployment

This project is auto-deployed to GitHub Pages on every push to `main` via the included GitHub Actions workflow (`.github/workflows/deploy.yml`).

### Setup GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source** and select **GitHub Actions**
3. Push to `main` — the workflow will build and deploy automatically
4. Your app will be live at `https://<username>.github.io/howlong/`

## Architecture

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Browser PWA │────▶│ Cloudflare Worker    │────▶│ Steam Store API  │
│  (Vite + TS) │     │ (CORS proxy + HLTB) │────▶│ HowLongToBeat    │
└──────────────┘     └─────────────────────┘     └──────────────────┘
         │
         ▼
  localStorage
  (HLTB cache)
```

- **Frontend**: Vanilla TypeScript + Vite, no framework
- **Proxy**: Cloudflare Worker with the `howlongtobeat` npm package
- **Caching**: HLTB results cached in localStorage for 7 days

## Project Structure

```
howlong/
├─ .github/workflows/deploy.yml   # GitHub Actions → GitHub Pages
├─ public/
│  ├─ icon.svg                     # SVG icon
│  ├─ manifest.json                # PWA manifest
│  └─ sw.js                        # Service worker
├─ src/
│  ├─ api/
│  │  ├─ config.ts                 # Proxy URL configuration
│  │  ├─ hltb.ts                   # HLTB API client
│  │  ├─ steam.ts                  # Steam API client
│  │  └─ types.ts                  # TypeScript type definitions
│  ├─ ui/
│  │  ├─ render.ts                 # DOM rendering (landing, dashboard, cards)
│  │  └─ sort.ts                   # Sort/filter logic & stats
│  ├─ cache.ts                     # localStorage HLTB cache
│  ├─ main.ts                      # App entry point & orchestration
│  └─ style.css                    # Complete design system
├─ worker/
│  ├─ src/index.ts                 # Cloudflare Worker proxy
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ wrangler.toml
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Tech Stack

- [Vite](https://vite.dev) — Build tool
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- Vanilla CSS — Dark theme with glassmorphism
- [Cloudflare Workers](https://workers.cloudflare.com/) — Serverless CORS proxy
- [howlongtobeat](https://github.com/ckatzorke/howlongtobeat) — HLTB data wrapper

## License

MIT
