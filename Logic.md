# Coffee Calculator — Calculation Logic Reference

> **Source of truth:** The Notion PRD governs all requirements. This file mirrors the PRD's approved calculation logic (reconciled 2026-06-19). If the two ever diverge, the PRD wins.

## Table of Contents

1. [Shared Concepts](#shared-concepts)
2. [Mode A — V60 Without Ice](#mode-a--v60-without-ice)
3. [Mode B — V60 With Ice](#mode-b--v60-with-ice)
4. [Mode C — South Indian Filter Coffee](#mode-c--south-indian-filter-coffee)
5. [Worked Examples](#worked-examples)
6. [Rounding Rules](#rounding-rules)

---

## Shared Concepts

| Term | Definition |
|---|---|
| **Dose** | Weight of dry ground coffee in grams (g) |
| **Ratio / Factor** | Multiplier applied to dose to get total water. Editable per recipe; default differs by mode |
| **Total Water** | `Dose × Ratio` |
| **Bloom Water** | Initial small pour to saturate grounds. Default: `Dose × 2` (editable) |
| **Bloom Time** | Seconds to rest after bloom pour. Default: `00:30` (editable) |
| **Remaining Water** | `Total Water − Bloom Water` (or `Brew Water − Bloom Water` for ice), split equally across the mode's pours |
| **Cumulative Reading** | Running total shown on the scale. The scale is zeroed once after the coffee is added and is **never reset** between pours. |

---

## Mode A — V60 Without Ice

### Inputs

| Input | Default |
|---|---|
| Coffee Dose (g) | — (required) |
| Ratio | 16 (editable) |
| Bloom Water (g) | `Dose × 2` (editable) |
| Bloom Time | `00:30` (editable) |

### Step-by-Step Formulas

```
Step 1 — Total Water
  Total Water = Dose × Ratio

Step 2 — Bloom Pour
  Bloom Water = Dose × 2
  (User may override this value)

Step 3 — Remaining Water
  Remaining = Total Water − Bloom Water
  Each Pour  = Remaining ÷ 3   (whole-gram rounding; see Rounding Rules)

Step 4 — Cumulative Scale Readings
  After Bloom  = Bloom Water
  After Pour 1 = Bloom Water + Pour 1
  After Pour 2 = Bloom Water + Pour 1 + Pour 2
  After Pour 3 = Total Water  ✓  (last pour absorbs the rounding remainder)
```

### Pour Sequence Table

| Pour | Water to Add (g) | Cumulative Scale Reading (g) | Action |
|---|---|---|---|
| Bloom | `Bloom Water` | `Bloom Water` | Wait bloom time before next pour |
| Pour 1 | `Each Pour` | `Bloom + Pour1` | — |
| Pour 2 | `Each Pour` | `Bloom + Pour1 + Pour2` | — |
| Pour 3 | `Each Pour` | `Total Water` | Done |

### Recalculation on Bloom Edit

When the user changes Bloom Water:

```
Remaining  = Total Water − New Bloom Water
Each Pour  = Remaining ÷ 3
```

All cumulative readings recalculate automatically.

**Constraint:** `Bloom Water` must be `> 0` and `< Total Water`.

---

## Mode B — V60 With Ice

### Inputs

Same as Mode A, plus an editable ice factor. Ice amount is always derived — never entered directly.

| Input | Default |
|---|---|
| Coffee Dose (g) | — (required) |
| Ratio | 16 (editable) |
| Ice Factor | 0.4 (editable) |
| Bloom Water (g) | `Dose × 2` (editable) |
| Bloom Time | `00:30` (editable) |

### Step-by-Step Formulas

```
Step 1 — Total Water (full recipe; stays constant)
  Total Water = Dose × Ratio

Step 2 — Ice Amount
  Ice (g) = Total Water × Ice Factor   (default factor 0.4)

Step 3 — Brew Water (hot water actually poured)
  Brew Water = Total Water − Ice

Step 4 — Bloom Pour
  Bloom Water = Dose × 2
  (User may override this value)

Step 5 — Remaining Brew Water
  Remaining = Brew Water − Bloom Water
  Each Pour  = Remaining ÷ 3   (whole-gram rounding; see Rounding Rules)

Step 6 — Cumulative Scale Readings
  (Scale tracks hot water only — ice is placed in the vessel beforehand)
  After Bloom  = Bloom Water
  After Pour 1 = Bloom Water + Pour 1
  After Pour 2 = Bloom Water + Pour 1 + Pour 2
  After Pour 3 = Brew Water  ✓  (last pour absorbs the rounding remainder)
```

### Pour Sequence Table

| Pour | Water to Add (g) | Cumulative Scale Reading (g) | Action |
|---|---|---|---|
| — | Place `Ice (g)` in serving vessel | — | Before brewing begins |
| Bloom | `Bloom Water` | `Bloom Water` | Wait bloom time |
| Pour 1 | `Each Pour` | `Bloom + Pour1` | — |
| Pour 2 | `Each Pour` | `Bloom + Pour1 + Pour2` | — |
| Pour 3 | `Each Pour` | `Brew Water` | Done |

### Recalculation on Bloom / Ice-Factor Edit

```
Ice        = Total Water × Ice Factor
Brew Water = Total Water − Ice
Remaining  = Brew Water − New Bloom Water
Each Pour  = Remaining ÷ 3
```

**Constraints:** `Bloom Water` must be `> 0` and `< Brew Water`. The ice factor must leave `Brew Water > Bloom Water` (warn otherwise).

---

## Mode C — South Indian Filter Coffee

### Overview

South Indian filter coffee uses a traditional metal drip filter and produces a **decoction (concentrate)**. There is a bloom followed by a **single main pour** — no 3-pour split and no ice mode. The decoction then drips through passively (expected total drawdown **7–10 min**). The calculator also outputs the **milk** quantity to heat and serve alongside.

> **Safety:** Remove the tamper / metal disk before brewing. (Surfaced as a UI note.)

### Inputs

| Input | Default |
|---|---|
| Coffee Dose (g) | — (required) |
| Water Ratio | 5 (editable) |
| Milk Ratio | 3 (editable) |
| Bloom Water (g) | `Dose × 2` (editable) |
| Bloom Time | `00:30` (editable) |
| Water Temp | 80–85 °C (guidance) |

### Formulas

```
Total Water (g) = Dose × Water Ratio
Total Milk (g)  = Dose × Milk Ratio    (displayed quantity to serve; not poured on the scale)

Bloom Water     = Dose × 2  (editable); swirl after the bloom
Main Pour       = Total Water − Bloom Water   (spiral from center, second swirl, lid on)

Cumulative Scale Readings:
  After Bloom = Bloom Water
  After Main  = Total Water  ✓
```

Treat **ml ≈ g** for water and milk. Milk is a served quantity only — it is not part of the cumulative scale readings.

> **Dilution** (Americano / piccolo / cappuccino from the decoction) is **not** calculated in this release — deferred to Future Enhancements.

### Pour Sequence Table

| Step | Water to Add (g) | Cumulative Scale Reading (g) | Action |
|---|---|---|---|
| Bloom | `Bloom Water` | `Bloom Water` | Wait bloom time (00:30), swirl |
| Main Pour | `Main Pour` | `Total Water` | Spiral pour, swirl, lid on |
| — | Heat & serve `Total Milk (g)` | — | Served alongside the decoction |

---

## Worked Examples

### Example 1 — V60 Without Ice

**Inputs:** Dose = 20 g, Ratio = 16, Bloom = default

```
Total Water  = 20 × 16        = 320 g
Bloom Water  = 20 × 2         =  40 g
Remaining    = 320 − 40       = 280 g
Each Pour    = 280 ÷ 3        ≈  93.3 g → 93, 93, 94 (last absorbs remainder)

Cumulative readings:
  After Bloom  =  40 g
  After Pour 1 = 133 g
  After Pour 2 = 226 g
  After Pour 3 = 320 g  ✓
```

---

### Example 2 — V60 Without Ice (edited bloom)

**Inputs:** Dose = 20 g, Ratio = 16, Bloom = 50 g (user-edited)

```
Total Water  = 20 × 16        = 320 g
Bloom Water  =                =  50 g  (edited)
Remaining    = 320 − 50       = 270 g
Each Pour    = 270 ÷ 3        =  90 g  (no remainder)

Cumulative readings:
  After Bloom  =  50 g
  After Pour 1 = 140 g
  After Pour 2 = 230 g
  After Pour 3 = 320 g  ✓
```

---

### Example 3 — V60 With Ice

**Inputs:** Dose = 20 g, Ratio = 16, Ice Factor = 0.4, Bloom = default

```
Total Water  = 20 × 16        = 320 g
Ice          = 320 × 0.4      = 128 g
Brew Water   = 320 − 128      = 192 g
Bloom Water  = 20 × 2         =  40 g
Remaining    = 192 − 40       = 152 g
Each Pour    = 152 ÷ 3        ≈  50.7 g → 51, 51, 50 (last absorbs remainder)

Cumulative readings (against Brew Water):
  After Bloom  =  40 g
  After Pour 1 =  91 g
  After Pour 2 = 142 g
  After Pour 3 = 192 g  ✓
```

---

### Example 4 — South Indian Filter Coffee

**Inputs:** Dose = 20 g, Water Ratio = 5, Milk Ratio = 3, Bloom = default

```
Total Water  = 20 × 5         = 100 g
Bloom Water  = 20 × 2         =  40 g
Main Pour    = 100 − 40       =  60 g
Total Milk   = 20 × 3         =  60 g  (heat & serve)

Cumulative readings:
  After Bloom = 40 g
  After Main  = 100 g  ✓
```

---

## Rounding Rules

- All displayed water values are rounded to **whole grams**.
- For multi-pour modes (A and B), the **final pour absorbs any rounding remainder** so the cumulative total always equals the exact target (no rounding drift).
- Intermediate calculations use full floating-point precision; only displayed values are rounded.
- A UI note should state: *"Values rounded to whole grams."*
