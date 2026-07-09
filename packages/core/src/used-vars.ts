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

/** Returns live CSS custom properties given usedClasses.
 *  Class-scoped: gated by usedClasses. Unscoped refs always live;
 *  decls propagate per-declaration via varDeclarations. */
export function extractUsedVars(cssRules: Iterable<CssPurgeIRRule>, usedClasses: ReadonlySet<string> | Iterable<string>): Set<string> {
  const rules = [...cssRules];
  const usedClassSet = usedClasses instanceof Set ? usedClasses : new Set(usedClasses);

  const classScopedRules = rules.filter((rule) => rule.classes.length > 0);
  const unscopedRules = rules.filter((rule) => rule.classes.length === 0);

  const usedVars = new Set<string>();
  const add = (varName: string): boolean => {
    if (usedVars.has(varName)) return false;
    usedVars.add(varName);
    return true;
  };

  for (const rule of classScopedRules) {
    if (!rule.classes.some((className) => usedClassSet.has(className))) continue;
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
