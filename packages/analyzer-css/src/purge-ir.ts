import type { CssPurgeIRRule, CssPurgeIRVarDeclaration } from "@purgeon/core";

import type { CssRule, CssVarDeclaration } from "./css-node";

export function toCssPurgeIR(rules: CssRule[]): CssPurgeIRRule[] {
  return rules.map(
    (rule: CssRule): CssPurgeIRRule => ({
      classes: rule.classes,
      dataAttrs: rule.dataAttrs,
      declaredVars: rule.declaredVars,
      referencedVars: rule.referencedVars,
      varDeclarations: rule.varDeclarations.map(
        (decl: CssVarDeclaration): CssPurgeIRVarDeclaration => ({
          name: decl.name,
          referencedVars: decl.referencedVars,
        }),
      ),
    }),
  );
}
