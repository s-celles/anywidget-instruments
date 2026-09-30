import pytest
from probe import Probe

import anywidget_instruments as ai
from anywidget_instruments import _liveness


def test_widgets_share_session_and_heartbeat():
    a, b = Probe(), Probe()
    assert a._session == b._session == _liveness.SESSION
    assert a.trait_metadata("_session", "sync")
    assert a._heartbeat == ai.get_heartbeat()


def test_set_heartbeat_updates_widgets():
    k = Probe()
    try:
        ai.set_heartbeat(5)
        assert k._heartbeat == 5
        assert Probe()._heartbeat == 5
        ai.set_heartbeat(0)
        assert k._heartbeat == 0
    finally:
        ai.set_heartbeat(2)
    with pytest.raises(ValueError):
        ai.set_heartbeat(-1)


def _group_of(widgets):
    g = _liveness._Group()
    for w in widgets:
        g.widgets.add(w)
    return g


def test_beat_sends_through_every_open_widget(monkeypatch):
    """Some models are never rendered (marimo wrappers): reach all of them."""
    sent = []
    widgets = [Probe(), Probe(), Probe()]
    for w in widgets:
        monkeypatch.setattr(w, "send", lambda msg, w=w: sent.append((w, msg)))
    widgets[1].close()
    assert _liveness.beat(_group_of(widgets)) == 2
    assert {id(w) for w, _ in sent} == {id(widgets[0]), id(widgets[2])}
    assert all(m["type"] == "hb" and m["session"] == _liveness.SESSION for _, m in sent)


def test_beat_skips_closed_widgets():
    w = Probe()
    w.close()
    assert _liveness.beat(_group_of([w])) == 0


def test_widgets_are_grouped_by_runtime_context(monkeypatch):
    """marimo run: one heartbeat thread per session (runtime context)."""
    monkeypatch.setattr(_liveness, "_groups", {})
    started = []
    monkeypatch.setattr(_liveness.threading.Thread, "start", lambda self: started.append(self))
    monkeypatch.setattr(_liveness, "_context_key", lambda: 1)
    a = Probe()
    monkeypatch.setattr(_liveness, "_context_key", lambda: 2)
    b = Probe()
    groups = _liveness._groups
    assert set(groups) == {1, 2}
    assert list(groups[1].widgets) == [a] and list(groups[2].widgets) == [b]
    assert len(started) == 2 and groups[1].thread is not groups[2].thread


def test_no_threads_disables_heartbeat(monkeypatch):
    """Pyodide (JupyterLite) cannot start threads: stale detection is disabled."""
    import threading

    def refuse(self):
        raise RuntimeError("can't start new thread")

    monkeypatch.setattr(_liveness, "_groups", {})
    monkeypatch.setattr(threading.Thread, "start", refuse)
    try:
        k = Probe()
        assert ai.get_heartbeat() == 0
        assert k._heartbeat == 0
    finally:
        monkeypatch.undo()
        ai.set_heartbeat(2)


def test_no_heartbeat_thread_under_pyodide_even_where_threads_start(monkeypatch):
    """marimo's WebAssembly runtime emulates threads on the event loop, so start()
    succeeds there; the heartbeat's blocking loop then collides with the kernel's
    own tasks. Under Pyodide no heartbeat thread is started at all (ROB-004)."""
    import threading

    started = []
    monkeypatch.setattr(_liveness, "_groups", {})
    monkeypatch.setattr(_liveness, "_threads_available", lambda: False)
    monkeypatch.setattr(threading.Thread, "start", lambda self: started.append(self))
    try:
        k = Probe()
        assert started == []
        assert ai.get_heartbeat() == 0
        assert k._heartbeat == 0
    finally:
        monkeypatch.undo()
        ai.set_heartbeat(2)
