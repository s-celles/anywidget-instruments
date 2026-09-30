// Trait contract generator (HOST-001, HOST-002), shared by the widget
// libraries built on anywidget-instruments. The JSON Schemas of a library are
// its single source of truth; they extend the base schema of this package by
// its $id (BASE_ID). This module flattens them ($ref, allOf) into:
//
//   a TypeScript module   trait interfaces and runtime specs (renderTs)
//   a contract.json file  description for host authors (renderJson)
//
// A library calls generate() from its own js/scripts/gen-contract.mjs with its
// schema directory and output paths. Every output is generated, never edited
// and never committed.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** $id prefix of the schemas of this package. */
export const BASE_ID = "https://anywidgetinstruments.github.io/anywidget-instruments/schema/";
/** Directory of the schemas of this package. */
export const BASE_SCHEMA_DIR = join(ROOT, "src/anywidget_instruments/schema");
/** Import path of the contract shape (contract/spec.ts), for generated modules. */
export const SPEC_IMPORT = "anywidget-instruments/js/src/contract/spec.js";

const WRITERS = new Set(["host", "both", "front", "derived"]);
const NONFINITE = ["nan", "inf", "-inf"];

// ---------------------------------------------------------------------------
// Loading and flattening. A schema is named by its file in the library's
// directory, or by the $id URL of a schema of an upstream package; relative
// references inside an upstream schema stay upstream.
// ---------------------------------------------------------------------------

/**
 * @param {string} dir directory of the library's schemas
 * @param {Array<{id: string, dir: string}>} upstream $id prefixes and their directories
 */
export function schemaLoader(dir, upstream = [{ id: BASE_ID, dir: BASE_SCHEMA_DIR }]) {
  const cache = new Map();
  const load = (name) => {
    if (!cache.has(name)) {
      const up = upstream.find((u) => name.startsWith(u.id));
      const path = up ? join(up.dir, name.slice(up.id.length)) : join(dir, name);
      cache.set(name, JSON.parse(readFileSync(path, "utf8")));
    }
    return cache.get(name);
  };
  load.upstream = upstream;
  return load;
}

/** Name of the document `ref` points to, seen from the document `from`. */
function documentOf(load, ref, from) {
  const target = ref.split("#")[0];
  if (!target) return from;
  if (/^https?:\/\//.test(target)) return target;
  const up = load.upstream.find((u) => from.startsWith(u.id));
  return up ? up.id + target : target;
}

function pointer(doc, ptr) {
  if (!ptr) return doc;
  return ptr
    .replace(/^\//, "")
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((node, key) => {
      if (node === undefined || !(key in node)) throw new Error(`unresolved JSON pointer ${ptr}`);
      return node[key];
    }, doc);
}

/** Resolve a $ref seen from the document `from`: [target schema, name of its document]. */
function resolveRef(load, ref, from) {
  const doc = documentOf(load, ref, from);
  return [pointer(load(doc), ref.split("#")[1] || ""), doc];
}

/** A property schema with its $ref merged in (sibling keywords win). */
function resolveProperty(load, prop, from) {
  if (!prop.$ref) return prop;
  const [target, doc] = resolveRef(load, prop.$ref, from);
  const { $ref: _ref, ...rest } = prop;
  return { ...resolveProperty(load, target, doc), ...rest };
}

/** Properties and messages of a schema, bases (allOf) first; later keywords override earlier ones. */
export function flatten(load, name) {
  const schema = load(name);
  const properties = {};
  const messages = [];
  let framework = [];
  for (const part of schema.allOf || []) {
    if (!part.$ref) throw new Error(`${name}: allOf entries must be $ref`);
    const base = flatten(load, documentOf(load, part.$ref, name));
    for (const [k, prop] of Object.entries(base.properties)) properties[k] = { ...prop };
    messages.push(...base.messages);
    framework = framework.concat(base.framework);
  }
  for (const [k, prop] of Object.entries(schema.properties || {})) {
    const own = resolveProperty(load, prop, name);
    // an own type, enum or const replaces the inherited type rather than merging with it
    const inherited = { ...(properties[k] || {}) };
    if (own.enum || own.const !== undefined || own.type || own.anyOf) {
      for (const key of ["type", "anyOf", "enum", "x-awi-nonfinite"]) if (!(key in own)) delete inherited[key];
    }
    properties[k] = { ...inherited, ...own };
  }
  // a message may be a $ref to a message of another schema (shared protocol)
  messages.push(...(schema["x-awi-messages"] || []).map((m) => (m.$ref ? resolveRef(load, m.$ref, name)[0] : m)));
  framework = framework.concat(schema["x-awi-framework-traits"] || []);
  return { schema, properties, messages, framework };
}

// ---------------------------------------------------------------------------
// Trait specs (the shape of contract/spec.ts)
// ---------------------------------------------------------------------------
export function traitSpec(name, p, where, nested = false) {
  const spec = {};
  let types = Array.isArray(p.type) ? [...p.type] : p.type ? [p.type] : [];
  if (Array.isArray(p.anyOf) && p.anyOf.some((alt) => alt.type === "null")) spec.nullable = true;
  if (types.includes("null")) {
    spec.nullable = true;
    types = types.filter((t) => t !== "null");
  }
  if (p.const !== undefined) {
    spec.type = "const";
    spec.values = [p.const];
  } else if (p["x-awi-binary"]) {
    // binary data: a buffer in Jupyter, base64 text in JSON-only hosts
    spec.type = "bytes";
  } else if (p["x-awi-nonfinite"]) {
    spec.type = "number";
    spec.nonfinite = true;
  } else if (p.enum && types.length === 0) {
    spec.type = "enum";
    spec.values = p.enum.filter((v) => v !== null);
    if (p.enum.includes(null)) spec.nullable = true;
  } else if (types.length === 1) {
    spec.type = types[0];
  } else if (types.length === 0) {
    spec.type = "any";
  } else if (types.every((t) => ["number", "integer", "string", "boolean"].includes(t))) {
    // a scalar of several types (a table cell): checked by the widget itself
    spec.type = "any";
  } else {
    throw new Error(`${where}.${name}: unsupported type ${JSON.stringify(p.type)}`);
  }
  for (const k of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]) if (p[k] !== undefined) spec[k] = p[k];
  if (p["x-awi-modulo"] !== undefined) spec.modulo = p["x-awi-modulo"];
  for (const k of ["minItems", "maxItems", "uniqueItems"]) if (p[k] !== undefined) spec[k] = p[k];
  if (p["x-awi-item-default"] !== undefined) spec.itemDefault = p["x-awi-item-default"];
  if (spec.type === "array") {
    if (Array.isArray(p.prefixItems)) spec.prefixItems = p.prefixItems.map((it, i) => traitSpec(`${name}[${i}]`, it, where, true));
    else if (p.items && typeof p.items === "object") spec.items = traitSpec(`${name}[]`, p.items, where, true);
  }
  if (spec.type === "object" && p.propertyNames?.enum) spec.keys = p.propertyNames.enum;
  if (spec.type === "object" && p.properties) {
    spec.properties = Object.fromEntries(Object.entries(p.properties).map(([k, v]) => [k, traitSpec(`${name}.${k}`, v, where, true)]));
  }
  if (nested) return spec;
  if (!("default" in p)) throw new Error(`${where}.${name}: missing default`);
  spec.default = p.default;
  const writer = p["x-awi-writer"];
  if (!WRITERS.has(writer)) throw new Error(`${where}.${name}: x-awi-writer must be one of ${[...WRITERS]}`);
  spec.writer = writer;
  if (p.readOnly) spec.readOnly = true;
  if (p["x-awi-resolved"]) spec.resolved = true;
  if (p["x-awi-transitions"]) spec.transitions = p["x-awi-transitions"];
  if (p["x-awi-simulated"]) spec.simulated = p["x-awi-simulated"];
  if (p["x-awi-source"]) spec.source = p["x-awi-source"];
  if (p["x-awi-presets"]) spec.presets = p["x-awi-presets"];
  if (p.description) spec.description = p.description;
  return spec;
}

/**
 * Flattened contract of the schemas of a library, keyed by schema title.
 *
 * @param {object} options
 * @param {string} options.dir directory of the library's schemas (every *.schema.json)
 * @param {Array<{id: string, dir: string}>} [options.upstream] schemas the library extends by $id
 * @param {string[]} [options.include] upstream schemas ($id) listed too, before the library's own
 * @param {string[]} [options.skip] files of `dir` that describe no widget
 * @param {string} [options.kindPrefix] prefix every concrete `_kind` of the library starts with
 * @param {(schema: object) => object} [options.extra] extra fields of a widget entry
 */
export function buildContract({ dir, upstream, include = [], skip = [], kindPrefix = "", extra = () => ({}) }) {
  const load = schemaLoader(dir, upstream);
  const own = readdirSync(dir).filter((f) => f.endsWith(".schema.json") && !skip.includes(f)).sort();
  const widgets = {};
  let framework = [];
  for (const name of [...include, ...own]) {
    const { schema, properties, messages, framework: fw } = flatten(load, name);
    const title = schema.title;
    if (!title || !/^[A-Z][A-Za-z0-9]*$/.test(title)) throw new Error(`${name}: title must be a class-like name`);
    if (!schema["x-awi-class"]) throw new Error(`${name}: missing x-awi-class`);
    const traits = {};
    for (const [trait, p] of Object.entries(properties)) traits[trait] = traitSpec(trait, p, name);
    const abstract = !!schema["x-awi-abstract"];
    const kind = traits._kind?.type === "const" ? traits._kind.values[0] : "";
    if (!abstract && !kind) throw new Error(`${name}: a concrete widget fixes _kind with a const`);
    if (!abstract && !include.includes(name) && !kind.startsWith(kindPrefix)) {
      throw new Error(`${name}: the _kind of a widget of this library starts with "${kindPrefix}"`);
    }
    const schemaPath = include.includes(name) ? name : `schema/${name}`;
    widgets[title] = { className: schema["x-awi-class"], kind, abstract, schema: schemaPath, traits, messages, ...extra(schema) };
    framework = framework.concat(fw);
  }
  return { widgets, frameworkTraits: [...new Set(framework)].sort(), load };
}

// ---------------------------------------------------------------------------
// TypeScript output
// ---------------------------------------------------------------------------
export function tsType(spec) {
  let t;
  switch (spec.type) {
    case "number":
    case "integer":
      t = spec.nonfinite ? `number | ${NONFINITE.map((v) => JSON.stringify(v)).join(" | ")}` : "number";
      break;
    case "string":
      t = "string";
      break;
    case "boolean":
      t = "boolean";
      break;
    case "enum":
    case "const":
      t = spec.values.map((v) => JSON.stringify(v)).join(" | ");
      break;
    case "array":
      if (spec.prefixItems) t = `[${spec.prefixItems.map(tsType).join(", ")}]`;
      else if (spec.items) t = `Array<${tsType(spec.items)}>`;
      else t = "unknown[]";
      break;
    case "bytes":
      t = "ArrayBuffer | ArrayBufferView | string";
      break;
    case "object":
      if (spec.keys) t = `Partial<Record<${spec.keys.map((k) => JSON.stringify(k)).join(" | ")}, string>>`;
      else if (spec.properties) t = `{ ${Object.entries(spec.properties).map(([k, v]) => `${k}?: ${tsType(v)}`).join("; ")} }`;
      else t = "Record<string, unknown>";
      break;
    default:
      t = "unknown";
  }
  return spec.nullable ? `${t} | null` : t;
}

function comment(out, text, indent = "") {
  if (text) out.push(`${indent}/** ${text.replace(/\*\//g, "* /")} */`);
}

/**
 * TypeScript module: one `<Title>Traits` interface per schema, `CONTRACTS`
 * keyed by title and `BY_KIND` keyed by `_kind`.
 *
 * @param {object} contract from buildContract
 * @param {object} options
 * @param {string} options.source what the module is generated from, for its header
 * @param {string} [options.specImport] import path of contract/spec.ts
 * @param {string[]} [options.runtimeOmit] widget fields left out of the runtime specs
 * @param {string[]} [options.append] lines added at the end of the module
 */
export function renderTs(contract, { source, specImport = SPEC_IMPORT, runtimeOmit = [], append = [] }) {
  const out = [
    `// Generated by js/scripts/gen-contract.mjs from ${source}.`,
    "// Do not edit: change the schemas and run `npm run gen`.",
    `import type { WidgetContract } from "${specImport}";`,
    "",
  ];
  const names = Object.keys(contract.widgets);
  for (const title of names) {
    const w = contract.widgets[title];
    comment(out, `Traits of \`${w.className}\`${w.kind ? ` (\`_kind\` "${w.kind}")` : ""}.`);
    out.push(`export interface ${title}Traits {`);
    for (const [name, spec] of Object.entries(w.traits)) {
      comment(out, spec.description, "  ");
      out.push(`  ${/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)}: ${tsType(spec)};`);
    }
    out.push("}", "");
  }
  const runtime = Object.fromEntries(
    names.map((n) => {
      const rest = { ...contract.widgets[n] };
      for (const k of ["schema", ...runtimeOmit]) delete rest[k];
      return [n, rest];
    }),
  );
  out.push("/** Flattened contract of every schema, keyed by schema title. */");
  out.push(`export const CONTRACTS: Record<${names.map((n) => JSON.stringify(n)).join(" | ")}, WidgetContract> = ${JSON.stringify(runtime, null, 2)};`, "");
  out.push("/** Contract of the concrete widgets, keyed by `_kind`. */");
  out.push("export const BY_KIND: Record<string, WidgetContract> = Object.fromEntries(");
  out.push("  Object.values(CONTRACTS).filter((c) => !c.abstract).map((c) => [c.kind, c]),");
  out.push(");");
  if (append.length) out.push("", ...append);
  return `${out.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Host description (contract.json)
// ---------------------------------------------------------------------------

/** Version of the Python package of a repository, from its pyproject.toml. */
export function pythonVersion(root) {
  const m = /^version\s*=\s*"([^"]+)"/m.exec(readFileSync(join(root, "pyproject.toml"), "utf8"));
  return m ? m[1] : "";
}

/**
 * @param {object} contract from buildContract
 * @param {object} options
 * @param {string} options.comment $comment of the file
 * @param {string} options.version version of the library
 * @param {object} [options.encoding] notes on how values travel
 * @param {object} [options.top] extra top-level fields, written before `widgets`
 * @param {string[]} [options.widgetFields] extra widget fields written when set, after `abstract`
 */
export function renderJson(contract, { comment: note, version, encoding, top = {}, widgetFields = [] }) {
  const widgets = {};
  for (const [title, w] of Object.entries(contract.widgets)) {
    const extra = Object.fromEntries(widgetFields.filter((k) => w[k]).map((k) => [k, w[k]]));
    widgets[title] = { class: w.className, kind: w.kind, abstract: w.abstract, ...extra, schema: w.schema, traits: w.traits, messages: w.messages };
  }
  return `${JSON.stringify(
    {
      $comment: note,
      format: 1,
      version,
      encoding: encoding ?? {
        nonfinite: 'Traits with nonfinite: true carry NaN and infinities as the strings "nan", "inf" and "-inf".',
      },
      frameworkTraits: contract.frameworkTraits,
      ...top,
      widgets,
    },
    null,
    2,
  )}\n`;
}

/** Write the generated files, creating their directories. */
export function writeOutputs(files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
}
