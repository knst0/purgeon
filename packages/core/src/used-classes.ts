import { splitClasses, collectPropSelections, evaluateClassVariantCalls } from "./class-evaluator";
import type { JsxPurgeIRNode } from "./purge-ir";

// TODO: classList support from solid v1
const CLASS_PROP_NAMES = new Set(["className", "class"]);

function matchCssSpecifierToId(specifier: string, resolvedIds: string[]): string | undefined {
  const specSegment = specifier.split("/").filter(Boolean).pop();
  if (!specSegment) return undefined;

  return resolvedIds.find((id) => {
    const normalized = id.replace(/\?.*$/, "").replace(/\\/g, "/");
    const idSegment = normalized.split("/").filter(Boolean).pop();
    return idSegment === specSegment;
  });
}

function normalizeModuleId(id: string): string {
  return id.replace(/\?.*$/, "").replace(/\\/g, "/");
}

/** Returns CSS class names referenced from JSX: static literals + cva/cx/tv/clsx.
 *  If `cssClasses` is given, intersects with it. */
export function extractUsedClasses(jsxNodes: Iterable<JsxPurgeIRNode>, cssClasses?: Iterable<string>): Set<string> {
  const nodes = [...jsxNodes];
  const used = new Set<string>();

  const flatProps = nodes.flatMap((node) => node.jsxUsages.flatMap((usage) => usage.props));
  const propSelections = collectPropSelections(flatProps);

  for (const node of nodes) {
    for (const usage of node.jsxUsages) {
      for (const prop of usage.props) {
        if (!CLASS_PROP_NAMES.has(prop.name) || typeof prop.value !== "string") continue;

        if (prop.kind === "literal") {
          for (const className of splitClasses(prop.value)) used.add(className);
        } else if (prop.kind === "css-module-ref") {
          const compositeKey = String(prop.value);
          const sepIdx = compositeKey.lastIndexOf("::");
          if (sepIdx === -1) continue;
          const specifier = compositeKey.slice(0, sepIdx);
          const className = compositeKey.slice(sepIdx + 2);
          const resolvedId = node.imports ? matchCssSpecifierToId(specifier, node.imports) : undefined;
          if (resolvedId) {
            used.add(`${normalizeModuleId(resolvedId)}::${className}`);
          }
        }
      }
    }
  }

  for (const className of evaluateClassVariantCalls(nodes, propSelections)) used.add(className);

  if (!cssClasses) return used;

  const cssClassSet = new Set(cssClasses);
  return new Set([...used].filter((className) => cssClassSet.has(className)));
}
