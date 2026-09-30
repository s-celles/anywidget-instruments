# Building a library on it

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
