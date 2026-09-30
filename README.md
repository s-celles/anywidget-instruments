# anywidget-instruments

The core of the anywidget-instruments family: what every widget library of the
family shares, and nothing else. It holds no widget of its own.

- **Base view** (TypeScript): the `BaseView` class every widget derives from:
  common traits (label, tooltip, size, visibility, disabled, mode), render
  scheduling, throttled value sending, and the contract registry.
- **Trait contract**: the base JSON Schema (`instrument.schema.json`), the
  runtime that reads traits through a schema, and the generator that flattens
  the schemas of a library into its TypeScript contract and its
  `contract.json` for host authors.
- **Themes and styles**: the `--awi-*` palettes, the modern, classic and system
  styles, the light, dark and system themes, and the frame of every widget
  (`styles.css`).
- **Liveness**: stale, missing and read-only indications when the kernel
  stops sending heartbeats.
- **Python base class**: `InstrumentWidget`, with callbacks that never break a
  widget, batches, heartbeats, `set_theme` and SVG skin sanitizing.

The widget libraries built on it:

| Library | Widgets | Documentation |
|---|---|---|
| [anywidget-instruments-industrial](https://github.com/AnywidgetInstruments/anywidget-instruments-industrial) | Gauges, tanks, LEDs, switches, charts, alarms, SCADA objects | <https://anywidgetinstruments.github.io/anywidget-instruments-industrial/> |
| [anywidget-instruments-automotive](https://github.com/AnywidgetInstruments/anywidget-instruments-automotive) | Speedometer, tachometer, tell-tales, trip computer, cluster | <https://anywidgetinstruments.github.io/anywidget-instruments-automotive/> |

## Using it in a library

Front end: depend on this repository at a commit, and bundle its TypeScript
sources with your widgets.

```json
"devDependencies": { "anywidget-instruments": "git+https://github.com/AnywidgetInstruments/anywidget-instruments.git#<commit>" }
```

```ts
import { BaseView, registerContracts } from "anywidget-instruments/js/src/core/view.js";
import { BY_KIND } from "./generated/contract.js";

registerContracts(BY_KIND); // once, in the entry point of the library
export class LampView extends BaseView { /* ... */ }
```

```css
@import "anywidget-instruments/js/src/styles.css";
```

Contract: the schemas of the library extend the base schema by its `$id`,
`https://anywidgetinstruments.github.io/anywidget-instruments/schema/instrument.schema.json`,
and `js/scripts/contract.mjs` (`buildContract`, `renderTs`, `renderJson`)
generates the library's contract from them.

Python: subclass `InstrumentWidget` once with the library's bundle.

```python
import anywidget_instruments as awi


class LampWidget(awi.InstrumentWidget):
    _esm = STATIC / "index.js"
    _css = STATIC / "index.css"
```

## Development

```bash
npm install && npm run typecheck && npm run lint && npm test
pip install -e ".[dev]" && pytest && ruff check . && ruff format --check . && mypy src
```

## License

BSD-3-Clause (see `LICENSE`).
