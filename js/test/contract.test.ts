// The trait contract generator (HOST-001, HOST-002): a library's schemas
// extend the base schema by its $id and are flattened into one contract.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
// @ts-expect-error: JavaScript module without declarations
import { BASE_ID, buildContract, renderJson, renderTs } from "../scripts/contract.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "schema");

describe("buildContract", () => {
  const contract = buildContract({ dir, kindPrefix: "test-" });
  const lamp = contract.widgets.Lamp;

  test("flattens the base traits into a widget of a library", () => {
    expect(lamp.kind).toBe("test-lamp");
    expect(lamp.abstract).toBe(false);
    for (const t of ["label", "disabled", "visible", "tooltip", "size", "style", "theme", "skin", "_session", "_heartbeat"]) {
      expect(lamp.traits).toHaveProperty(t);
    }
    expect(lamp.messages.map((m: { type: string }) => m.type)).toContain("hb");
    expect(contract.frameworkTraits).toContain("_esm");
  });

  test("an own enum replaces the inherited type", () => {
    expect(lamp.traits.mode).toMatchObject({ type: "enum", values: ["indicator"], default: "indicator" });
  });

  test("a null in an enum makes the trait nullable", () => {
    expect(lamp.traits.value).toMatchObject({ type: "enum", values: ["off", "on"], nullable: true, default: null });
  });

  test("a $ref to a definition of the base schema is resolved", () => {
    expect(lamp.traits.level).toMatchObject({ type: "number", nullable: true, minimum: 0, maximum: 1 });
  });

  test("the base schema is listed only when included", () => {
    expect(contract.widgets).not.toHaveProperty("Instrument");
    const withBase = buildContract({ dir, include: [`${BASE_ID}instrument.schema.json`] });
    expect(withBase.widgets.Instrument).toMatchObject({ className: "InstrumentWidget", abstract: true });
    expect(withBase.widgets.Instrument.schema).toBe(`${BASE_ID}instrument.schema.json`);
  });

  test("a concrete kind outside the prefix of the library is rejected", () => {
    expect(() => buildContract({ dir, kindPrefix: "awa-" })).toThrow(/starts with "awa-"/);
  });
});

describe("outputs", () => {
  const contract = buildContract({ dir });

  test("TypeScript: interfaces, CONTRACTS and BY_KIND", () => {
    const ts = renderTs(contract, { source: "test", append: ["export const EXTRA = 1;"] });
    expect(ts).toContain('import type { WidgetContract } from "anywidget-instruments/js/src/contract/spec.js";');
    expect(ts).toContain("export interface LampTraits {");
    expect(ts).toContain('  value: "off" | "on" | null;');
    expect(ts).toContain("export const BY_KIND");
    expect(ts.trimEnd().endsWith("export const EXTRA = 1;")).toBe(true);
  });

  test("contract.json for host authors", () => {
    const json = JSON.parse(renderJson(contract, { comment: "test", version: "1.0" }));
    expect(json).toMatchObject({ format: 1, version: "1.0", $comment: "test" });
    expect(json.widgets.Lamp).toMatchObject({ class: "Lamp", kind: "test-lamp", schema: "schema/lamp.schema.json" });
  });
});
