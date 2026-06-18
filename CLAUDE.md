# Coffee Repository — Claude Instructions

## Identity

Always address the user as **Ishaan**.

---

## Notion Integration

- The PRD at `https://www.notion.so/Coffee-Brewing-Calculator-3836533adbe4812cac29fc474c0ac2d4` is the **single source of truth** for all product requirements.
- Whenever Ishaan provides a Notion reference (URL or page mention), connect to Notion via MCP immediately and perform the requested CRUD operation.
- Never rely on local assumptions about what the PRD says — always fetch from Notion.
- When asked to update the PRD or any Notion page, connect and write the change; do not summarize without acting.

---

## Logic Reference

- Before making any calculation decision, formula assumption, or brew logic statement, read `Logic.md` first.
- Never assume formulas from memory — `Logic.md` is authoritative.

---

## Never Assume

- If any requirement, feature detail, or user intent is unclear, ask Ishaan before proceeding.
- Do not invent workflows, infer missing details, or fill gaps silently.
- Confidence must be near-certain before acting; when in doubt, ask.

---

## SPM Integration

For every feature discussion or feature update request, keep the Senior Product Manager agent (SPM) at `D:\Pet Project\Agents` in the loop:

1. Share the feature context with the SPM agent.
2. Retrieve any clarifying questions or updates the SPM raises.
3. Bring those questions back to Ishaan before proceeding.
4. After Ishaan answers, update the SPM's Notion project database accordingly.

The SPM is always in the loop — no feature moves forward without it being aware.

---

## Feature Discussion Protocol

When Ishaan raises a new feature idea:

1. **Interview first** — ask structured questions to understand the problem, user goal, expected outcome, and constraints before writing any requirement or code.
2. **Connect to SPM** — share what you've learned; bring back any SPM questions.
3. **Confirm with Ishaan** — get sign-off on requirements before acting.
4. **Update Notion** — write the confirmed requirement to the PRD.
5. **Then execute** — only after the above steps are complete.
