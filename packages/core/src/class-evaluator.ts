import type { JsxPurgeIRNode } from "./purge-ir";
import { UNRESOLVED_REF_KEY } from "./unresolved-ref";

export type ClassEvaluatorNode = Omit<JsxPurgeIRNode, "jsxUsages">;

export function splitClasses(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return splitClasses(value);
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value === null || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}

export interface VariantPropSelection {
  values: Set<string>;
  dynamic: boolean;
}

export function collectPropSelections(props: Iterable<{ name: string; kind: string; value?: unknown }>): Map<string, VariantPropSelection> {
  const selections = new Map<string, VariantPropSelection>();

  for (const prop of props) {
    if (prop.kind === "spread") continue;

    let selection = selections.get(prop.name);
    if (!selection) {
      selection = { values: new Set(), dynamic: false };
      selections.set(prop.name, selection);
    }

    if (prop.kind === "literal" && typeof prop.value === "string") selection.values.add(prop.value);
    else selection.dynamic = true;
  }

  return selections;
}

export function extractClassStrings(value: unknown, callName: string, propSelections: Map<string, VariantPropSelection>): string[] {
  if (typeof value === "string") return splitClasses(value);

  if (Array.isArray(value)) return value.flatMap((el) => extractClassStrings(el, callName, propSelections));

  if (value === null || typeof value !== "object") return [];

  if (callName === "cva" || callName === "tv") {
    const obj = value as Record<string, unknown>;
    const result: string[] = [];

    if ("base" in obj) result.push(...collectStrings(obj.base));

    const slots = obj.slots;
    if (slots && typeof slots === "object") {
      for (const slotValue of Object.values(slots as Record<string, unknown>)) result.push(...collectStrings(slotValue));
    }

    const variants = obj.variants;
    const defaultVariants =
      obj.defaultVariants && typeof obj.defaultVariants === "object" ? (obj.defaultVariants as Record<string, unknown>) : {};

    if (variants && typeof variants === "object") {
      for (const [groupName, options] of Object.entries(variants as Record<string, unknown>)) {
        if (!options || typeof options !== "object") continue;

        const selection = propSelections.get(groupName);
        const canNarrow = selection !== undefined && !selection.dynamic && selection.values.size > 0;

        for (const [optionKey, optionValue] of Object.entries(options as Record<string, unknown>)) {
          if (canNarrow && !selection!.values.has(optionKey) && optionKey !== defaultVariants[groupName]) continue;
          result.push(...collectStrings(optionValue));
        }
      }
    }

    if (Array.isArray(obj.compoundVariants)) {
      for (const compoundVariant of obj.compoundVariants as Record<string, unknown>[]) {
        result.push(...collectStrings(compoundVariant.class ?? compoundVariant.className));
      }
    }

    return result;
  }

  const result: string[] = [];
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === true) result.push(...splitClasses(key));
    else if (typeof val !== "boolean") result.push(...extractClassStrings(val, callName, propSelections));
  }
  return result;
}

function matchSpecifierToId(specifier: string, resolvedIds: string[]): string | undefined {
  const specNoExt = specifier.replace(/\.[jt]sx?$/, "");
  const lastSegment = specNoExt.split("/").filter(Boolean).pop();
  if (!lastSegment) return undefined;

  return resolvedIds.find((id) => {
    const idNoExt = id.replace(/\.[jt]sx?$/, "");
    return idNoExt === lastSegment || idNoExt.endsWith(`/${lastSegment}`);
  });
}

function isUnresolvedRef(value: unknown): value is { [UNRESOLVED_REF_KEY]: string } {
  return value !== null && typeof value === "object" && Object.keys(value).length === 1 && UNRESOLVED_REF_KEY in value;
}

function resolveRefs(value: unknown, node: ClassEvaluatorNode, exportsByModuleId: Map<string, Record<string, unknown>>): unknown {
  if (isUnresolvedRef(value)) {
    const identifierName = value[UNRESOLVED_REF_KEY];
    const binding = node.importBindings?.[identifierName];
    if (!binding) return undefined;

    const targetModuleId = matchSpecifierToId(binding.source, node.imports ?? []);
    const targetExports = targetModuleId ? exportsByModuleId.get(targetModuleId) : undefined;
    const resolved = targetExports?.[binding.imported];
    return resolved === undefined ? undefined : resolveRefs(resolved, node, exportsByModuleId);
  }

  if (Array.isArray(value)) return value.map((el) => resolveRefs(el, node, exportsByModuleId));

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, resolveRefs(val, node, exportsByModuleId)]));
  }

  return value;
}

/** Evaluates cva/cx/tv/clsx calls across nodes, resolving cross-module refs
 *  and variant-prop narrowing. Returns statically referenced class strings. */
export function evaluateClassVariantCalls(
  nodes: readonly ClassEvaluatorNode[],
  propSelections: Map<string, VariantPropSelection>,
): Set<string> {
  const used = new Set<string>();

  const exportsByModuleId = new Map<string, Record<string, unknown>>();
  for (const node of nodes) {
    if (node.id && node.staticExports) exportsByModuleId.set(node.id, node.staticExports);
  }

  for (const node of nodes) {
    for (const call of node.classVariantCalls) {
      const resolvedConfig = resolveRefs(call.config, node, exportsByModuleId);
      for (const className of extractClassStrings(resolvedConfig, call.name, propSelections)) used.add(className);
    }
  }

  return used;
}
