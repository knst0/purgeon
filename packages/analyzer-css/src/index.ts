import { CssAnalyzer } from "./css-analyzer";
import type { CssAnalyzerOptions } from "./css-node";

export * from "./class-graph";
export * from "./css-analyzer";
export * from "./css-node";
export * from "./purge-ir";
export * from "./var-graph";

export const cssAnalyzer = (options?: CssAnalyzerOptions) => new CssAnalyzer(options);
