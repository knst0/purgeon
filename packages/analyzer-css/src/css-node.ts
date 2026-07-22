import type { GraphNode } from "@purgeon/core";

export interface CssVarDeclaration {
  name: string;
  referencedVars: string[];
}

export interface CssRule {
  classes: string[];
  dataAttrs: string[];
  declarations: string[];
  declaredVars: string[];
  referencedVars: string[];
  varDeclarations: CssVarDeclaration[];
}

export interface CssGraphNode extends GraphNode {
  rules: CssRule[];
}

export interface CssAnalyzerOptions {
  filename?: string;
}
