import type { CssPurgeIRRule } from "./purge-ir";
/** All CSS custom property names (declared or referenced) across the given rules. */
export function collectAllVars(cssRules: Iterable<CssPurgeIRRule>): Set<string> {
  const all = new Set<string>();
  for (const rule of cssRules) {
    for (const varName of rule.declaredVars) all.add(varName);
    for (const varName of rule.referencedVars) all.add(varName);
  }
  return all;
}

/** Returns live CSS custom properties given usedSelectorKeys (class names and/or `[data-*]` attribute
 *  liveness keys, see `dataAttrsOf`). Class- or attribute-scoped rules are gated by usedSelectorKeys;
 *  fully unscoped rules (e.g. bare `:root`) are always live; decls propagate per-declaration via varDeclarations. */
export function extractUsedVars(cssRules: Iterable<CssPurgeIRRule>, usedSelectorKeys: ReadonlySet<string> | Iterable<string>): Set<string> {
  const rules = [...cssRules];
  const usedKeySet = usedSelectorKeys instanceof Set ? usedSelectorKeys : new Set(usedSelectorKeys);

  const isScoped = (rule: CssPurgeIRRule) => rule.classes.length > 0 || (rule.dataAttrs?.length ?? 0) > 0;
  const scopedRules = rules.filter(isScoped);
  const unscopedRules = rules.filter((rule) => !isScoped(rule));

  const usedVars = new Set<string>();
  const add = (varName: string): boolean => {
    if (usedVars.has(varName)) return false;
    usedVars.add(varName);
    return true;
  };

  for (const rule of scopedRules) {
    const keys = rule.dataAttrs ? [...rule.classes, ...rule.dataAttrs] : rule.classes;
    if (!keys.some((key) => usedKeySet.has(key))) continue;
    for (const varName of rule.declaredVars) add(varName);
    for (const varName of rule.referencedVars) add(varName);
  }

  for (const rule of unscopedRules) {
    const declaredNames = new Set((rule.varDeclarations ?? []).map((decl) => decl.name));
    for (const varName of rule.referencedVars) {
      if (!declaredNames.has(varName)) add(varName);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of unscopedRules) {
      for (const declaration of rule.varDeclarations ?? []) {
        if (!usedVars.has(declaration.name)) continue;
        for (const varName of declaration.referencedVars) changed = add(varName) || changed;
      }
    }
  }

  return usedVars;
}
