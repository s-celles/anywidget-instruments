"""The base class of every widget (API-001 .. API-011, STYLE-005 .. STYLE-007)."""

from __future__ import annotations

import pytest
import traitlets as t
from probe import Probe

import anywidget_instruments as ai


def test_on_change_callback_and_decorator():
    w = Probe()
    seen = []

    @w.on_change
    def _(change):
        seen.append(change["new"])

    w.value = 12
    assert seen == [12]


def test_on_change_decorator_with_arguments():
    w = Probe()
    seen = []

    @w.on_change(names="label")
    def _(change):
        seen.append(change["new"])

    w.label = "Gain"
    w.value = 1
    assert seen == ["Gain"]


def test_callback_exception_is_logged_and_widget_keeps_working(capsys):
    w = Probe()
    seen = []

    def bad(change):
        raise RuntimeError("boom")

    w.on_change(bad)
    w.observe(lambda c: seen.append(c["new"]), names="value")
    w.value = 1
    w.value = 2
    assert seen == [1, 2]
    err = capsys.readouterr().err
    assert "boom" in err and "Probe" in err


def test_unobserve_wrapped_handler():
    w = Probe()
    seen = []

    def cb(c):
        seen.append(c["new"])

    w.observe(cb, names="value")
    w.unobserve(cb, names="value")
    w.value = 3
    assert seen == []


def test_batch_runs_callbacks_when_the_block_exits():
    w = Probe()
    seen = []
    w.on_change(lambda c: seen.append(c["new"]))
    with ai.batch():
        w.value = 1
        assert seen == []
    assert seen == [1]


def test_size_must_be_positive():
    with pytest.raises(t.TraitError, match="size"):
        Probe(size=(0, 10))


def test_skin_is_sanitized_and_its_parts_validated():
    svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script><circle r="1"/></svg>'
    w = Probe(skin={"knob": svg})
    assert "script" not in w.skin["knob"] and "circle" in w.skin["knob"]
    with pytest.raises(t.TraitError, match="unknown part"):
        Probe(skin={"wheel": "<svg/>"})


def test_set_theme_switches_open_and_new_widgets():
    try:
        w = Probe()
        ai.set_theme("dark")
        assert w.theme == "dark" and Probe().theme == "dark"
        with pytest.raises(ValueError, match="theme"):
            ai.set_theme("blue")
    finally:
        ai.set_theme("auto")
    assert w.theme == "auto"


def test_default_style_applies_to_new_widgets():
    try:
        ai.set_default_style("classic")
        assert Probe().style == "classic"
        with pytest.raises(ValueError, match="style"):
            ai.set_default_style("neon")
    finally:
        ai.set_default_style("modern")


def test_a_widget_announces_the_kernel_session():
    w = Probe()
    assert w._session and w._heartbeat == ai.get_heartbeat()


def test_mode_and_size_traits_carry_class_defaults():
    class Indicator(Probe):
        mode = ai.mode_trait("indicator")
        size = ai.size_trait(80, 40)
        _default_mode = "indicator"
        _default_size = (80, 40)

    assert Indicator.class_traits()["mode"].default_value == "indicator"
    assert Indicator().size == (80, 40)


def test_float_serializers_carry_non_finite_values_as_text():
    to_json = ai.float_serializers["to_json"]
    from_json = ai.float_serializers["from_json"]
    assert to_json([float("nan"), float("inf"), 1.0], None) == ["nan", "inf", 1.0]
    assert from_json("-inf", None) == float("-inf")
