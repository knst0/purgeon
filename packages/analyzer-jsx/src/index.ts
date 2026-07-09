import { JsxAnalyzer } from "./jsx-analyzer";
import type { JsxAnalyzerOptions } from "./jsx-node";

export { JsxAnalyzer } from "./jsx-analyzer";
export { toJsxPurgeIR } from "./purge-ir";
export type { JsxAnalyzerOptions, JsxGraphNode, JsxUsage, ClassVariantCall, StyledComponentUsage } from "./jsx-node";
export const jsxAnalyzer = (options?: JsxAnalyzerOptions) => new JsxAnalyzer(options);
