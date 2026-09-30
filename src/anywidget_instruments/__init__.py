"""Base of the anywidget-instruments family of widget libraries.

It holds what every library shares: the base class :class:`InstrumentWidget`
(common traits, callbacks, kernel liveness), the styles and themes, and the
base trait contract (``schema/instrument.schema.json``). The widgets
themselves come from the libraries built on it, such as
anywidget-instruments-industrial and anywidget-instruments-automotive.
"""

from __future__ import annotations

import pathlib

from ._base import (
    SKIN_PARTS,
    Callback,
    InstrumentWidget,
    float_serializers,
    mode_trait,
    size_trait,
)
from ._dispatch import batch
from ._liveness import get_heartbeat, set_heartbeat
from ._sanitize import sanitize_svg
from ._style import (
    STYLES,
    THEMES,
    get_default_style,
    get_default_theme,
    set_default_style,
    set_theme,
)

__version__ = "0.1.0.dev0"

#: Directory of the base JSON Schemas, which the schemas of a library extend by $id.
SCHEMA_DIR = pathlib.Path(__file__).parent / "schema"

#: $id prefix of the base JSON Schemas.
SCHEMA_ID = "https://anywidgetinstruments.github.io/anywidget-instruments/schema/"

__all__ = [
    "SCHEMA_DIR",
    "SCHEMA_ID",
    "SKIN_PARTS",
    "STYLES",
    "THEMES",
    "Callback",
    "InstrumentWidget",
    "batch",
    "float_serializers",
    "get_default_style",
    "get_default_theme",
    "get_heartbeat",
    "mode_trait",
    "sanitize_svg",
    "set_default_style",
    "set_heartbeat",
    "set_theme",
    "size_trait",
]
