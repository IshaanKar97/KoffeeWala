# KoffeeWala — Design Guidelines

> Derived from the reference UI mockup (2026-06-26). **Current scope: visual re-skin only** —
> adopt the palette, geometry, and component styling below; keep the existing screen
> structure and flow. The structural ideas (guided step-by-step brew, circular timer ring,
> bottom-tab shell, dedicated Recipes tab) are documented under "Future / out of scope" for a
> later phase, not this re-skin.

## Design intent
Warm, calm, **cozy specialty-coffee** — guided, not clinical. Three qualities to preserve:
1. **Warm & tactile** — cream "paper" backgrounds, espresso-brown accents, soft rounded cards, gentle shadows. No pure white, no cold gray.
2. **Confident hero numbers** — the key value on a screen (pour target, timer) is large; everything else recedes.
3. **Approachable** — named choices over raw numbers where possible; friendly copy.

The single biggest shift from today: **stone-gray + amber-700 → cream + espresso-brown.**

## Color tokens
Approximate values from the reference. Use as CSS variables; map Tailwind utilities to them.

```css
:root {
  --bg:        #EFE7DA; /* app canvas (warm beige) */
  --surface:   #FBF7F0; /* cards / inputs */
  --surface-2: #FFFDF8; /* raised surface */
  --primary:   #95623A; /* espresso — buttons, active, key figures */
  --primary-press: #824F2C;
  --text:      #3A2E25; /* headings, hero numbers */
  --muted:     #998A7A; /* labels, captions, hints */
  --border:    #E9E0D2; /* hairlines, dividers, unselected chips */
  --gold:      #E1A23A; /* rating stars */
  --warn-bg:   #F7E3DC; /* warning card bg */
  --warn:      #C0563F; /* warning text / icon (terracotta) */
  --soon-bg:   #ECE3D3; /* "coming soon" pill */
  --soon-text: #8A7A66;
  --radius-card:    20px;
  --radius-control: 14px;
  --shadow: 0 4px 16px rgba(80, 60, 40, 0.06);
}
```

| Role | Token | Replaces (current) |
|---|---|---|
| Canvas | `--bg` | `from-stone-100 to-stone-200` gradient |
| Card / input | `--surface` / `--surface-2` | `bg-white`, `border-stone-200/300` |
| Primary action / active | `--primary` | `bg-amber-700` |
| Primary text | `--text` | `text-stone-900` |
| Muted text | `--muted` | `text-stone-500` |
| Hairline | `--border` | `border-stone-200` |
| Stars | `--gold` | `text-amber-*` |
| Warning | `--warn-bg` / `--warn` | amber error block / `bg-red-50` |

## Typography
Humanist/geometric sans (Inter / SF / Poppins family). **Tabular numerals** for timer + targets.

| Token | Size (≈) | Weight | Example |
|---|---|---|---|
| Hero number | 48–64px | Bold | `120 g`, `00:32` |
| Screen title | 20–24px | Semibold | "Logbook" |
| Card title | 16–18px | Semibold | "Main Pour" |
| Body | 14–16px | Regular | hints, notes |
| Label / overline | 11–12px | Medium, muted, uppercase | "Coffee dose" |

## Geometry
- **Radius:** cards `~20px` (`rounded-2xl`/`3xl`), buttons & inputs `~14px` (`rounded-xl`), chips & dose stepper **full pill**, timer is a true circle.
- **Spacing:** generous — `16–20px` card padding, `12–16px` between cards, ≥44px tap targets.
- **Elevation:** one soft warm shadow (`--shadow`) + the hairline border. No hard/black shadows.

## Component re-skin specs (in scope)
Restyle existing components to these specs; behavior unchanged.

| Component | Re-skin notes |
|---|---|
| **Buttons** | Primary = solid `--primary`, white text, `radius-control`, press → `--primary-press`. Secondary = `--surface` fill + `--border` outline, `--text`. "Brew/Save Again" = primary + repeat icon. |
| **Instrument / method cards** | Icon + name + 2-word descriptor ("Clean & bright"); selected = `--primary` border + tinted fill (not solid-filled segmented buttons). |
| **Dose input** | Pill stepper `−  18 g  +` (replaces the free-text number field — also fixes the mobile-keyboard audit item). |
| **Chips** (taste notes, filters) | Pill; selected = `--primary` fill + white + ✓; unselected = `--surface` + `--border` + `--muted`. |
| **Stat / pour cards** | `--surface`, `radius-card`, `--shadow`; hero figure in `--text`/`--primary`, label in `--muted` overline. |
| **Rating stars** | `--gold`, outline when empty. |
| **Logbook / recipe card** | Method icon, dose·water, time, stars, note snippet, "Brew Again". |
| **Warning state** | `--warn-bg` card + droplet icon + `--warn` text; inline, non-blocking (matches the "soft warnings" direction). |
| **Hint card** | Tinted `--surface`/`--border` info card under the action. |
| **Inputs / selects** | `--surface`, `--border`, `radius-control`; focus ring in `--primary` at low alpha. |
| **Tabs / nav** | Active = `--primary`; consider a bottom tab bar on mobile (Brew · Logbook · Recipes) — see Future. |

## Signature patterns worth keeping in mind (lightweight wins)
- **Named "Strength"** abstraction over ratio (Light / Balanced / Strong → ratios), raw ratio under Advanced. (Addresses the ratio-legibility audit item.)
- **Hero number** treatment for the current total/pour figures.
- **Inline warning** styling for atypical values (soft, non-blocking).

## Future / out of scope for this re-skin
Documented for a later phase, not this pass:
- **Guided step-by-step brew flow** (full-screen per pour) with a **circular timer ring**.
- **Bottom tab shell** + mobile single-column restructure.
- **Recipes** as a first-class tab (saved/favorited recipe templates, distinct from Logbook history).
- Success / "brew saved" celebration screen; Settings (Units, Brew Defaults, Cloud Sync placeholder).

---
*Reference: design mockup shared 2026-06-26. See the project memory `project-ux-audit-phase3` and the Notion "Design System / UI Guidelines" doc.*
