import { collectPropSelections, type VariantPropSelection } from "./class-evaluator";
import type { JsxPurgeIRNode, JsxPurgeIRProp } from "./purge-ir";

const DATA_ATTR_PATTERN = /^data-/;

function stringifyAttrValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Narrows a `data-x={props.color}`-style prop-forwarding attribute using literal usages of that
 *  prop name elsewhere in the app (same narrowing model as cva/tv variant groups). Falls back to the
 *  wildcard key when the referenced prop is itself used dynamically anywhere, or never used literally. */
function addPropRefKeys(used: Set<string>, prop: JsxPurgeIRProp, propSelections: Map<string, VariantPropSelection>): void {
  const selection = prop.propRef ? propSelections.get(prop.propRef) : undefined;

  if (!selection || selection.dynamic || selection.values.size === 0) {
    used.add(`${prop.name}=*`);
    return;
  }

  for (const value of selection.values) used.add(`${prop.name}=${value}`);
  if (prop.fallback !== undefined) used.add(`${prop.name}=${prop.fallback}`);
}

/** Returns liveness keys for JSX `data-*` attribute usages, matching the key format produced by
 *  `dataAttrsOf`: presence key (`data-x`) for every usage, plus an exact-value key (`data-x=y`) for
 *  static literals or values narrowed from a forwarded prop, or a wildcard key (`data-x=*`) when the
 *  value is genuinely dynamic (unknown at build time). */
export function extractUsedDataAttrs(jsxNodes: Iterable<JsxPurgeIRNode>): Set<string> {
  const nodes = [...jsxNodes];
  const used = new Set<string>();

  const flatProps = nodes.flatMap((node) => node.jsxUsages.flatMap((usage) => usage.props));
  const propSelections = collectPropSelections(flatProps);

  for (const node of nodes) {
    for (const usage of node.jsxUsages) {
      for (const prop of usage.props) {
        if (!DATA_ATTR_PATTERN.test(prop.name)) continue;

        used.add(prop.name);

        if (prop.kind === "literal") {
          const value = stringifyAttrValue(prop.value);
          if (value !== null) used.add(`${prop.name}=${value}`);
        } else if (prop.kind === "prop-ref") {
          addPropRefKeys(used, prop, propSelections);
        } else if (prop.kind !== "spread") {
          used.add(`${prop.name}=*`);
        }
      }
    }
  }

  return used;
}
