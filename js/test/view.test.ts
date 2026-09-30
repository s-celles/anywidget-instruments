// The base view (API-001 .. API-011, STYLE-007, ROB-001): common traits read
// through the registered contract, the widget frame, themes and liveness.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { WidgetContract } from "../src/contract/spec.js";
import * as traits from "../src/contract/traits.js";
import { BaseView, contractOf, registerContracts } from "../src/core/view.js";
import { fakeModel } from "./helpers.js";

const CONTRACT: WidgetContract = {
  className: "Lamp",
  kind: "test-lamp",
  abstract: false,
  messages: [],
  traits: {
    _kind: { type: "const", values: ["test-lamp"], default: "test-lamp", writer: "host" },
    mode: { type: "enum", values: ["control", "indicator"], default: "indicator", writer: "host" },
    label: { type: "string", default: "", writer: "host" },
    size: { type: "array", prefixItems: [{ type: "integer", minimum: 1 }, { type: "integer", minimum: 1 }], default: [160, 160], writer: "host" },
    theme: { type: "enum", values: ["auto", "light", "dark", "system"], default: "auto", writer: "host" },
    visible: { type: "boolean", default: true, writer: "host" },
    level: { type: "number", minimum: 0, maximum: 1, default: 0, writer: "host" },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  registerContracts({ "test-lamp": CONTRACT });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function mount(state: Record<string, unknown>) {
  const model = fakeModel(state);
  const el = document.createElement("div");
  document.body.append(el);
  const view = new BaseView(model, el);
  return { model, el, view };
}

describe("contract registry", () => {
  test("a view reads its traits through the contract registered for its kind", () => {
    expect(contractOf("test-lamp")).toBe(CONTRACT);
    const { view } = mount({ _kind: "test-lamp", level: 5, mode: "dial" });
    expect(view.contract).toBe(CONTRACT);
    expect(view.get("level")).toBe(1); // clamped to the schema bounds
    expect(view.get("mode")).toBe("indicator"); // invalid: the default
    expect(view.get("label")).toBe(""); // missing: the default
  });

  test("a kind with no contract reads its traits as they come", () => {
    const { view } = mount({ _kind: "unknown", level: 5 });
    expect(view.contract).toBeUndefined();
    expect(view.get("level")).toBe(5);
  });

  test("a trait is read again only when its raw value changes (PERF-002)", () => {
    const { model, view } = mount({ _kind: "test-lamp", size: [200, 100] });
    const spy = vi.spyOn(traits, "readTrait");
    const first = view.get("size");
    expect(view.get("size")).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    model.set("size", [300, 100]);
    expect(view.get("size")).toEqual([300, 100]);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe("frame", () => {
  test("label as text, size, mode and theme classes", () => {
    const { el, view } = mount({ _kind: "test-lamp", label: "<b>Lamp</b>", size: [120, 80], theme: "dark" });
    view.renderCommon();
    const root = el.querySelector(".awi-root") as HTMLElement;
    expect(root.classList.contains("awi-test-lamp")).toBe(true);
    expect(root.classList.contains("awi-indicator")).toBe(true);
    expect(root.classList.contains("awi-theme-dark")).toBe(true);
    expect(root.querySelector(".awi-label")?.textContent).toBe("<b>Lamp</b>");
    expect(root.querySelector("b")).toBeNull();
    expect((root.querySelector(".awi-body") as HTMLElement).style.width).toBe("120px");
  });

  test('"system" follows the theme of the host page (STYLE-007)', () => {
    document.body.setAttribute("data-theme", "dark");
    const { el, view } = mount({ _kind: "test-lamp", theme: "system" });
    view.renderCommon();
    expect(el.querySelector(".awi-root")?.classList.contains("awi-theme-dark")).toBe(true);
    document.body.removeAttribute("data-theme");
  });

  test("destroy removes the widget and its listeners", () => {
    const { el, view } = mount({ _kind: "test-lamp" });
    view.destroy();
    expect(el.querySelector(".awi-root")).toBeNull();
  });
});

describe("liveness (ROB-001)", () => {
  test("a host that announces heartbeats and stops sending them shows the stale badge", async () => {
    const { model, el, view } = mount({ _kind: "test-lamp", _session: "s-view", _heartbeat: 1 });
    model.emit("msg:custom", { type: "hb", session: "s-view" });
    view.renderCommon();
    const badge = el.querySelector(".awi-stale-badge") as HTMLElement;
    expect(badge.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    view.renderCommon();
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toMatch(/STALE/);
  });
});
