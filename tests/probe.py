"""A minimal widget of a library built on anywidget-instruments, for the tests."""

from __future__ import annotations

import traitlets as t

import anywidget_instruments as ai


class Probe(ai.InstrumentWidget):
    """A widget with a numeric value and a front end that draws nothing."""

    _esm = "export default { render() {} };"
    _kind = t.Unicode("test-probe").tag(sync=True)
    value = t.Float(0.0).tag(sync=True)
