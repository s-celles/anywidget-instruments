"""The base trait contract (HOST-001): the schema and the Python class agree."""

from __future__ import annotations

import json

import jsonschema
import traitlets as t
from probe import Probe

import anywidget_instruments as ai

SCHEMA = json.loads((ai.SCHEMA_DIR / "instrument.schema.json").read_text())
FRAMEWORK = set(SCHEMA["x-awi-framework-traits"])


def test_the_schema_is_named_by_the_published_id():
    assert SCHEMA["$id"] == ai.SCHEMA_ID + "instrument.schema.json"
    assert SCHEMA["x-awi-class"] == "InstrumentWidget" and SCHEMA["x-awi-abstract"]
    jsonschema.Draft202012Validator.check_schema(SCHEMA)


def test_every_synced_trait_of_the_base_class_is_in_the_schema():
    synced = {k for k in ai.InstrumentWidget.class_traits(sync=True) if k not in FRAMEWORK}
    assert synced == set(SCHEMA["properties"])


def test_class_defaults_are_the_schema_defaults():
    traits = ai.InstrumentWidget.class_traits(sync=True)
    for name, prop in SCHEMA["properties"].items():
        if name in {"_kind", "size"}:
            continue
        default = traits[name].default()
        assert default == prop["default"], name


def test_the_state_of_a_widget_conforms_to_the_schema():
    state = {k: v for k, v in Probe().get_state().items() if k in SCHEMA["properties"]}
    state["size"] = list(state["size"])
    jsonschema.Draft202012Validator(SCHEMA).validate(state)


def test_theme_values_match_the_style_module():
    assert SCHEMA["properties"]["theme"]["enum"] == list(ai.THEMES)
    assert SCHEMA["properties"]["style"]["enum"] == list(ai.STYLES)
    assert isinstance(ai.InstrumentWidget.class_traits()["theme"], t.Enum)
