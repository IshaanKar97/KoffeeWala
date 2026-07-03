# Coffee Calculator — Calculation Logic Reference

> **Source of truth:** The Notion PRD governs all requirements. This file mirrors the **shipped app's** calculation logic (reconciled 2026-07-01 to Phase 2 + Phase 3). If the two ever diverge, the PRD wins.

The calculator is an **Instrument × Brewing Method** model.
**Instruments:** V60 · Filter Coffee · **Mokka-Pot** (disabled "coming soon" placeholder — no calc).

---

## Shared concepts

| Term | Definition |
|---|---|
| **Dose** | Weight of dry ground coffee (g). |
| **Ratio** | Multiplier applied to dose to get total water. Editable; default differs by method. |
| **Total Water** | `Dose × Ratio`. |
| **Bloom Water** | Initial pour to saturate grounds (V60 only). |
| **Target** | The water the pours are split over: **Brew water** when ice is on, otherwise **Total water**. |
| **Cumulative Reading** | Running total shown on the scale. The scale is zeroed once after the coffee is added and **never reset** between pours. |

**Rounding:** all displayed water values are whole grams; the **final pour absorbs any rounding remainder** so the cumulative total always equals the exact target. Intermediate math uses full precision. The UI shows *"Values rounded to whole grams."*

---

## V60

Methods: **1-Pour · 3-Pour · 10-Pour · Advanced**. Ice is a **toggle** (OFF by default) that applies to every method.

### Inputs
| Input | Default |
|---|---|
| Coffee dose (g) | — (required) |
| Ratio | **16**, editable (1/3/10-pour; Advanced uses it too — see below) |
| Ice toggle | OFF |
| Ice factor | **0.4**, editable (shown when Ice is ON) |
| Bloom water (g) | **2 × dose, fixed** for 1/3/10-pour; **editable only in Advanced** |
| Number of pours | 1 / 3 / 10 by method; **user-set in Advanced** |
| Total water (g) | Advanced only, optional — **overrides the ratio when entered** |
| Bloom time | `00:30` (editable, numeric min:sec) |
| Grind size | optional, structured (see Grind size below) |

### Formulas
```
Total water   = Dose × Ratio
  (Advanced: if a Total water is entered directly, it OVERRIDES the ratio.)

Ice ON:  Ice        = Total × Ice factor
         Brew water = Total − Ice
         Target     = Brew water        (pours split the brew water)
Ice OFF: Target     = Total

Bloom water = 2 × Dose   (fixed for 1/3/10-pour; editable in Advanced)

Pours after bloom (N equal pours):
  Each pour = (Target − Bloom) ÷ N   (whole grams; last pour absorbs the remainder)
  N = 1 (1-Pour) · 3 (3-Pour) · 10 (10-Pour) · user-set (Advanced)

Cumulative readings:
  After bloom  = Bloom
  After pour i = Bloom + pour 1 + … + pour i
  After last   = Target  ✓
```

**Constraint:** bloom must be `> 0` and `< Target` (with ice, lower the ice factor or bloom if this fails).

---

## Filter Coffee — South Indian decoction (**no bloom**)

Methods: **With Milk · With Water**. **No bloom step** (client decision 2026-06-26): a **single full pour** of the decoction water. The decoction then drips through passively (expected drawdown **7–10 min**).

> **Safety:** remove the tamper / metal disk before brewing (surfaced as a UI note). Water **80–85 °C**.

### Inputs
| Input | Default |
|---|---|
| Coffee dose (g) | — (required) |
| Water ratio | **5**, editable |
| Milk ratio | **3**, editable (With Milk) |
| Water (dilution) ratio | **4**, editable (With Water) |

### Formulas
```
Total (decoction) water = Dose × Water ratio      → single "Pour" (cumulative = Total)

With Milk:   Milk to serve   = Dose × Milk ratio        (served alongside; not poured on the scale)
With Water:  Dilution water  = Dose × Dilution ratio     (added to taste; not poured on the scale)
```
Milk / dilution are served quantities only — not part of the cumulative scale readings. Treat ml ≈ g.

---

## Grind size (Phase 3 — structured input)

Grind is recorded in one of three interconvertible formats via the **active grinder** (managed in **Equipment → Grinders**):
- **clicks** (default) — a per-grinder slider; converts to microns via the grinder's µm/click.
- **grade** — Extra Fine … Extra Coarse, mapped to **200 µm bands over 0–1400 µm** (universal).
- **microns** — 0–1400 (universal).

Seeded grinders: **Timemore + Comandante** (+ custom); default **Timemore C3S** (0–950 µm over ~25 clicks ≈ 38 µm/click). Conversions are **approximate** (linear per-grinder µm/click). Grind is **not** part of the water calculation; it is stored on a brew as a readable summary + canonical microns, e.g. `Medium · ~608µm · 16 clicks (Timemore C3S)`.

Optional **water temperature** (toggle, default OFF, °C) applies to all methods and is captured as a note.

---

## Worked examples

**V60 · 3-Pour** — dose 20, ratio 16
```
Total 320 · Bloom 40 · Remaining 280 ÷ 3 = 93,93,94 → reads 40,133,226,320 ✓
```

**V60 · 3-Pour + Ice** — dose 20, ratio 16, ice factor 0.4
```
Total 320 · Ice 128 · Brew 192 · Bloom 40 · Remaining 152 ÷ 3 = 51,51,50 → reads 40,91,142,192 ✓
```

**V60 · 10-Pour** — dose 20, ratio 16
```
Total 320 · Bloom 40 · 280 ÷ 10 = 28 each → reads 40,68,96,…,320 ✓
```

**V60 · Advanced** — dose 20, total 300 (overrides ratio), bloom 40, N = 2
```
Remaining 260 ÷ 2 = 130,130 → reads 40,170,300 ✓
```

**Filter · With Milk** — dose 20, water ratio 5, milk ratio 3
```
Total 100 (single pour) → reads 100 ✓ · Milk to serve = 60
```

**Filter · With Water** — dose 20, water ratio 5, dilution ratio 4
```
Total 100 (single pour) → reads 100 ✓ · Dilution water = 80
```

---

## Rounding rules
- Displayed water values are **whole grams**.
- For multi-pour methods, the **final pour absorbs the rounding remainder** so the cumulative total equals the exact target (no drift).
- Intermediate calculations use full precision; only displayed values are rounded.
