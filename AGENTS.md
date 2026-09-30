# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## Project

`anywidget-instruments`: the core of the anywidget-instruments family. The widget
libraries, anywidget-instruments-industrial and anywidget-instruments-automotive,
depend on it and on nothing else of the family. It holds what they share: the base
view, the base trait contract and its generator, themes and styles, liveness and the
Python base class. It holds no widget.

Requirements come from `docs/specification.md`. A change of behaviour goes through
that file first (bump its version and its revision history).

## Layout

| Path | Content |
|---|---|
| `js/src/core/` | `view.ts` (`BaseView`, contract registry), `model.ts` (AFM model), `liveness.ts`, `pagetheme.ts`, `dom.ts`, `scale.ts` |
| `js/src/contract/` | `spec.ts` (shape of a flattened contract), `traits.ts` (schema-driven reading) |
| `js/src/styles.css` | Palettes, styles, themes and the widget frame, scoped under `.awi-root` |
| `js/scripts/contract.mjs` | Contract generator used by every library |
| `src/anywidget_instruments/` | Python base class, dispatcher, liveness, styles, SVG sanitizing |
| `src/anywidget_instruments/schema/` | Base JSON Schema, `$id` under `https://anywidgetinstruments.github.io/anywidget-instruments/schema/` |

The TypeScript sources are not built here: each library bundles them with its own
widgets. Anything a widget displays is computed in the front end.

## Commands

```bash
npm install && npm run typecheck && npm run lint && npm test
pip install -e ".[dev]" && pytest && ruff check . && ruff format --check . && mypy src
mkdocs build --strict
```

After a change, rebuild the libraries against the new commit and run their checks.

## Rules

- Only what serves every instrument family belongs here; widgets and their rules
  stay in their library.
- The `$id` of a schema is an identifier the libraries refer to: change it only with
  them.
- Security: never `innerHTML`, `eval`, `new Function`; text through `textContent`.
- Every bug fix comes with a test that fails without the fix.
- Repository content is in English. Do not name, cite or compare with third-party
  products or projects whose ideas inspired a feature.

## Git

- Author and committer: the repository owner's identity (never an AI identity).
- No `Co-Authored-By` trailer for AI, no model or tool names in commit messages,
  code, comments or documentation.
- Commit messages: imperative subject ≤ 72 characters, blank line, body stating the
  problem, then the change; end with `Assisted-by: AI` when AI assisted.
- Never commit generated files.
