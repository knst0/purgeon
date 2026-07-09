import type { GraphNode } from "@purgeon/core";

export interface JsxUsage {
  component: string | null;
  resolvedFrom: string | null;
  props: unknown[];
}

export interface ClassVariantCall {
  name: string;
  static: boolean;
  config: unknown;
  rawCode: string | null;
}

export interface StyledComponentUsage {
  baseTag: string | null;
  kind: "element" | "component";
}

export interface ImportBinding {
  source: string;
  imported: string;
}

export interface JsxGraphNode extends GraphNode {
  jsxUsages: JsxUsage[];
  classVariantCalls: ClassVariantCall[];
  styledComponentUsages: StyledComponentUsage[];
  importBindings: Record<string, ImportBinding>;
  staticExports: Record<string, unknown>;
}

export interface JsxAnalyzerOptions {
  trackedCalls?: string[];
}
