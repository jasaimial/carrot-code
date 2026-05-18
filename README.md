# carrot-code

A 2D pixel-art platformer built as a learning project — equal parts game
programming fundamentals and [Spec-Driven Development][sdd] practice.

**Status:** pre-MVP. No playable build yet. Implementation is on the
[`001-vertical-slice`][slice] branch.

**Live demo:** _not yet deployed — link will land here after the
vertical slice ships._

## What's interesting here

This repo is unusual in two ways:

1. **Spec-first, end-to-end.** Every commit traces to a spec. Before any
   code was written, the project produced a [constitution][constitution],
   a [feature spec][spec], an [implementation plan][plan], and an
   [ordered task list][tasks] — all reviewed and analyzed via Spec Kit's
   `/speckit.*` slash-command workflow.

2. **The methodology itself is a deliverable.** The
   [`docs/learning/`][learning] directory captures the workflow as a
   replicable how-to and a chronological journal — useful for anyone
   evaluating Spec-Driven Development on a real project rather than a
   blog-post example.

## What to read

| You're here because...          | Start with...                                   |
| ------------------------------- | ----------------------------------------------- |
| You're considering Spec Kit     | [docs/learning/README.md][learning]             |
| You want to reproduce the setup | [docs/learning/00-setup-from-zero.md][setup]    |
| You want to understand the game | [specs/001-vertical-slice/spec.md][spec]        |
| You want the technical plan     | [specs/001-vertical-slice/plan.md][plan]        |
| You want to know the rules      | [.specify/memory/constitution.md][constitution] |

## Running locally

Requires Node.js ≥ 20.

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # vite build → dist/
```

CI runs all of the above on every PR; see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## License

MIT — see [LICENSE](LICENSE) (forthcoming).

All committed game assets are CC0 / public domain or otherwise unrestricted;
sources and licenses are recorded in `public/assets/CREDITS.md` (forthcoming).

[sdd]: https://github.com/github/spec-kit
[slice]: https://github.com/jasaimial/carrot-code/tree/001-vertical-slice
[constitution]: .specify/memory/constitution.md
[spec]: specs/001-vertical-slice/spec.md
[plan]: specs/001-vertical-slice/plan.md
[tasks]: specs/001-vertical-slice/tasks.md
[learning]: docs/learning/README.md
[setup]: docs/learning/00-setup-from-zero.md
