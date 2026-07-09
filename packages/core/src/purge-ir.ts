/** Property on a JSX element usage. */
export interface JsxPurgeIRProp {
  name: string;
  kind: string;
  value?: unknown;
}

/** One JSX element usage in a module. */
export interface JsxPurgeIRUsage {
  props: JsxPurgeIRProp[];
}

/** A cva/cx/tv/clsx call signature tracked by the analyzer. */
export interface JsxPurgeIRVariantCall {
  name: string;
  static: boolean;
  config: unknown;
}

/** Maps import specifier → imported name for resolving UnresolvedRef markers. */
export interface JsxPurgeIRImportBinding {
  source: string;
  imported: string;
}

/** Per-module JSX output from the JSX analyzer, projected for cross-referencing. */
export interface JsxPurgeIRNode {
  id?: string;
  imports?: string[];
  jsxUsages: JsxPurgeIRUsage[];
  classVariantCalls: JsxPurgeIRVariantCall[];
  importBindings?: Record<string, JsxPurgeIRImportBinding>;
  staticExports?: Record<string, unknown>;
}

/** Pairs a declared custom property with vars its value references.
 *  Enables per-declaration propagation within a single rule. */
export interface CssPurgeIRVarDeclaration {
  name: string;
  referencedVars: string[];
}

/** A single CSS rule, projected from the CSS analyzer for cross-referencing. */
export interface CssPurgeIRRule {
  classes: string[];
  declaredVars: string[];
  referencedVars: string[];
  varDeclarations?: CssPurgeIRVarDeclaration[];
}
