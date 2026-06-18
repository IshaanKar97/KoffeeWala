# Coffee Brewing Calculator

A precision brewing calculator that generates step-by-step pour guides for three brew methods. Enter your coffee dose and the calculator outputs exact water amounts, cumulative scale readings, and timing for each pour.

---

## Brew Modes

### Mode A — V60 Without Ice
Standard V60 pour-over. Takes dose and ratio, produces a bloom + 3-pour sequence with cumulative scale readings.

### Mode B — V60 With Ice
Iced V60. Derives ice amount automatically (40% of total water). Brew water is poured hot over the ice — cumulative readings track hot water only.

### Mode C — South Indian Filter Coffee
Traditional drip filter. No pour sequence — outputs total water for the upper chamber and total milk to serve alongside the decoction.

---

## Tech Stack

React + Vite + Tailwind CSS (v4). Calculation logic lives in a framework-free pure module with unit tests.

## Run Locally

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm test         # run the calculation unit tests
npm run build    # production build into dist/
```

## Deployment (Netlify)

The app is a static Vite build, configured for **Netlify** via `netlify.toml` (build command, publish dir, SPA redirect, pinned Node version).

### Option A — Netlify CLI (no git repo required)

```bash
npm install -g netlify-cli
netlify login            # authorize your Netlify account in the browser
npm run build            # produce dist/
netlify deploy           # draft/preview deploy → returns a preview URL
netlify deploy --prod    # publish to your live site
```

### Option B — Continuous deploy from Git

1. Push this repo to GitHub/GitLab (the repo is not yet git-initialized).
2. Netlify dashboard → **Add new site → Import an existing project** → pick the repo.
3. Build settings auto-detect from `netlify.toml` (build `npm run build`, publish `dist`).
4. Every push to the production branch redeploys automatically.

### Future: Notion sync secret

When two-way Notion sync is built, the integration token will live as a Netlify **environment variable** (`NOTION_TOKEN`) read only by a serverless function in `netlify/functions/` — never bundled into the client. Set it under **Site settings → Environment variables**.

## Key Files

| File | Purpose |
|------|---------|
| `Logic.md` | Authoritative calculation reference — all formulas, constraints, rounding rules, and worked examples |
| `src/lib/calculations.js` | Pure calculation module (one function per brew mode); mirrors `Logic.md` |
| `src/lib/calculations.test.js` | Vitest unit tests covering the worked examples + no-drift invariant |
| `src/App.jsx` | Calculator UI (mode tabs, inputs, live recipe table) |
| `src/components/Field.jsx` | Reusable labelled number input |
| `netlify.toml` | Netlify deploy config (build command, publish dir, SPA redirect, Node version) |
| `README.md` | This file — project overview |
| `CLAUDE.md` | Claude Code operating instructions for this repository |

---

## Notion Source of Truth

The PRD for this project lives in Notion and is the single source of truth for all product requirements:

**Coffee Brewing Calculator PRD:**
https://www.notion.so/Coffee-Brewing-Calculator-3836533adbe4812cac29fc474c0ac2d4
