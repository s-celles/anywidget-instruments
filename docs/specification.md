# Specification

| Field | Value |
|-------|-------|
| Project | anywidget-instruments (core of the family) |
| Author | Sébastien Celles |
| Document type | Software requirements specification |
| Notation | EARS (Easy Approach to Requirements Syntax); priorities MoSCoW: **M** must, **S** should, **C** could |
| Version | 0.1 |
| Date | 2026-09-30 |

## 1. Scope

anywidget-instruments is the core the widget libraries of the family are built
on: anywidget-instruments-industrial and anywidget-instruments-automotive. It
holds what every instrument family shares, and no widget. The requirements
below were first written for anywidget-instruments-industrial, which held this
code before it was extracted; they keep their identifiers, and the libraries
refer to them.

## 2. Family (FAM)

| ID | Pri | Requirement |
|---|---|---|
| FAM-001 | M | The package shall provide the base view, the base Python class, the base trait contract and its generator, the styles and themes, and the kernel liveness, and no widget. |
| FAM-002 | M | A widget library shall depend on this package only, and not on another widget library of the family. |
| FAM-003 | M | The package shall ship its TypeScript sources unbuilt: each library bundles them with its own widgets, so that a library's bundle carries its own copy. |
| FAM-004 | M | Each library shall register the contracts of its widgets, keyed by `_kind`; the base view shall read the traits of a widget through the contract registered for its kind, and read them as they come when none is registered. |
| FAM-005 | M | The `$id` of the base schemas shall start with `https://anywidgetinstruments.github.io/anywidget-instruments/schema/`; a library's schemas shall extend them by that `$id`. |

## 3. Common widget behaviour (API)

| ID | Pri | Requirement |
|---|---|---|
| API-001 | M | The package shall provide a common base class from which every widget of the family derives. |
| API-003 | M | Every widget shall expose a `mode` trait accepting the values `"control"` and `"indicator"`; a library may restrict it to one of them. |
| API-004 | M | While a widget is in indicator mode, the widget shall ignore user pointer and keyboard input that would modify `value`. |
| API-006 | M | When the user changes the value of a widget in control mode, the widget shall send the new value to the kernel. |
| API-007 | M | Every widget shall expose `label`, `disabled`, `visible` and `tooltip` traits. |
| API-009 | M | Every widget shall support registration of Python callbacks via an `observe`-compatible interface and via an `on_change(callback)` convenience method. |
| API-010 | S | Every widget shall accept a `size` trait (width and height in CSS pixels). |
| API-011 | M | While `disabled` is true, the widget shall render in a greyed style and shall reject user input. |

## 4. Styles and themes (STYLE)

| ID | Pri | Requirement |
|---|---|---|
| STYLE-001 | M | The package shall provide three visual styles: `modern`, `classic` (flat, low detail) and `system` (follows the host theme colors). |
| STYLE-002 | M | While the host is in dark mode, widgets using the `system` style shall use dark-theme colors. |
| STYLE-003 | M | The package shall define all widget colors through CSS custom properties (`--awi-*`), so that users can override them per widget or per page. |
| STYLE-004 | S | The package shall provide a global function to set the default style for all widgets created afterwards. |
| STYLE-006 | M | If a supplied skin SVG contains scripts, event handler attributes or external references, then the package shall strip them before rendering. |
| STYLE-007 | S | Every widget shall accept a `theme` of `auto`, `light`, `dark` or `system` (`system` follows the host or operating system color scheme whatever the style); `light` and `dark` shall apply their palette whatever the host theme, and the package shall provide a function switching every open widget. |

## 5. Robustness and liveness (ROB, HOST)

| ID | Pri | Requirement |
|---|---|---|
| ROB-001 | M | If the kernel is disconnected or restarted, then every widget shall display a stale-data indication and shall reject user input until the connection is restored. |
| ROB-002 | M | If a Python callback raises an exception, then the package shall log the exception in the notebook output and shall keep the widget operational. |
| ROB-003 | M | If a trait is assigned a value of an invalid type, then the package shall raise a `TraitError` with a message naming the widget and trait. |
| HOST-001 | M | The package shall describe the traits common to every widget in a JSON Schema shipped in the package, and shall provide the generator that flattens a library's schemas into its front-end trait types and its host description file (`contract.json`). |
| HOST-002 | M | When the front end reads a trait of a widget that has a schema, the front end shall read it through the schema: a value of the wrong type shall be replaced by the schema default, a number outside the schema bounds shall be clamped to them, and non-finite floats encoded as strings shall be decoded. |
| HOST-003 | M | The front end shall enable the stale-data indication only when the host announces heartbeats, with a non-empty `_session` and a `_heartbeat` period greater than 0. The class defaults of these two traits shall announce nothing, and the Python package shall announce them for every widget it creates. |
| HOST-007 | M | The class default of every synchronized trait of the base class shall equal the default given by the base schema. |

## 6. Performance, security, accessibility

| ID | Pri | Requirement |
|---|---|---|
| GEN-010 | M | When a library is imported, it shall not modify global notebook state or register global CSS outside its own widget roots (`.awi-root`). |
| PERF-003 | S | The base view shall coalesce successive updates arriving within one animation frame, and render only the latest. |
| PERF-005 | S | While a widget is not visible in the viewport, the base view shall skip rendering and resume on becoming visible. |
| SEC-001 | M | The front-end code shall not use `eval`, `new Function` or `innerHTML` with data coming from traits. |
| SEC-002 | M | The package shall render label and tooltip strings as text, never as HTML. |
| A11Y-005 | S | Where the user agent requests reduced motion, the widgets shall disable animations. |

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-09-30 | First version: the base view, contract, themes, liveness and Python base class extracted from anywidget-instruments-industrial (its specification 0.15); FAM-001 .. FAM-005 added. |
