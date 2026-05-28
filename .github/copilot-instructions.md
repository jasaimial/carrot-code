<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at [specs/002-shipping-infrastructure/plan.md](../specs/002-shipping-infrastructure/plan.md).
<!-- SPECKIT END -->

<!-- AGENT-DISCIPLINE START -->
## Agent discipline (additive to the constitution)

The constitution at [.specify/memory/constitution.md](../.specify/memory/constitution.md)
is the governing rulebook. The two rules below close gaps the
constitution does not cover explicitly. They apply to every change you
propose, regardless of which spec or branch you're working on.

Adapted from [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)
(MIT). Only the two genuinely-additive principles are kept here;
"Simplicity First" is already covered by Constitution IX + XI, and
"Goal-Driven Execution" is already covered by Constitution VI plus the
acceptance-criteria format in every `tasks.md`.

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations of the request exist, present them — don't
  pick silently.
- If a simpler approach exists than the one the user proposed, say so.
  Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

This is the in-task counterpart to Constitution Principle II (Spec-First).
Spec-First governs feature scope; this governs how you handle ambiguity
*within* an already-scoped task.

### 2. Surgical changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting that the
  current task didn't ask you to change.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code or a real bug nearby, mention it in
  chat — don't silently delete or fix it.

When your changes create orphans:

- Remove imports / variables / functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless explicitly asked.

The test: every changed line in the diff should trace directly to the
user's request or to a constitution-mandated check. If a reviewer asks
"why did this line change?", the answer must be one of those two.

This rule exists because past sessions on this repo have produced
drive-by edits (whole-repo `npm run format` runs, opportunistic comment
rewrites) that cost more time to clean up than they saved. The
canonical reminder lives in `HANDOVER.md` under "Conventions reminders
(often-forgotten)".

<!-- AGENT-DISCIPLINE END -->
