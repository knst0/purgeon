import { writeFileSync } from "node:fs";

import { toCssPurgeIR, type CssGraphNode } from "@purgeon/analyzer-css";
import { toJsxPurgeIR, type JsxGraphNode } from "@purgeon/analyzer-jsx";
import { extractUsedClasses, extractUsedVars, isAnalyzer, purgeUnusedCss, type AnalyzerPlugin, type OutputBundle } from "@purgeon/core";
import type { Plugin as RolldownPlugin } from "rolldown";

type PurgeonPluginResult = RolldownPlugin & { enforce?: "pre" | "post" };

export function purgeon(options: PluginOptions = {}): PurgeonPluginResult {
  const wrappers = (options.plugins ?? [])
    .filter((p) => isAnalyzer(p))
    .map((p) => ({ plugin: p.toRolldownPlugin(), getGraph: () => p.getGraph() }));
  const outFile = resolveDebugOutFile(options.debug);
  let usage: UsageReport | null = null;

  return {
    name: "purgeon",
    enforce: "pre",

    transform(code, id) {
      for (const wrapper of wrappers) {
        try {
          wrapper.plugin.transform.call(this as any, code, id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.warn(`[${wrapper.plugin.name}] failed to analyze ${id}: ${message}`);
        }
      }
      return null;
    },

    moduleParsed(moduleInfo) {
      for (const wrapper of wrappers) {
        wrapper.plugin.moduleParsed.call(this, moduleInfo);
      }
    },

    generateBundle(options, bundle) {
      for (const wrapper of wrappers) {
        wrapper.plugin.generateBundle.call(this as any, options, bundle as any);
      }

      usage = reportUsage(wrappers, this);
      if (usage) purgeBundle(bundle as unknown as OutputBundle, usage.usedClasses, usage.usedVars);
    },

    writeBundle() {
      if (!outFile) return;

      const graphs: Record<string, unknown> = {};
      for (const wrapper of wrappers) {
        graphs[wrapper.plugin.name] = wrapper.getGraph().toObject();
      }
      if (usage) {
        graphs.usedClasses = usage.classes;
        graphs.usedVars = usage.vars;
      }

      try {
        writeFileSync(outFile, JSON.stringify(graphs, null, 2), "utf-8");
        this.info(`Wrote debug output to ${outFile}`);
      } catch (error) {
        this.warn(`Failed to write debug output to ${outFile}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

interface UsageSummary {
  used: string[];
  unused: string[];
  total: number;
  usedCount: number;
  unusedCount: number;
}

function summarize(used: Set<string>, total: Set<string>): UsageSummary {
  const unused = [...total].filter((name) => !used.has(name));
  return { used: [...used], unused, total: total.size, usedCount: used.size, unusedCount: unused.length };
}

interface UsageReport {
  classes: UsageSummary;
  vars: UsageSummary;
  usedClasses: Set<string>;
  usedVars: Set<string>;
}

interface AnalyzerWrapper {
  plugin: ReturnType<AnalyzerPlugin["toRolldownPlugin"]>;
  getGraph: () => ReturnType<AnalyzerPlugin["getGraph"]>;
}

function reportUsage(wrappers: AnalyzerWrapper[], ctx: { info(msg: string): void }): UsageReport | null {
  const jsxWrapper = wrappers.find((w) => w.plugin.name === "jsx-graph");
  const cssWrapper = wrappers.find((w) => w.plugin.name === "css-graph");
  if (!jsxWrapper || !cssWrapper) return null;

  const jsxNodes = [...jsxWrapper.getGraph().values()].map((n) => toJsxPurgeIR(n as JsxGraphNode));
  const cssRules = [...cssWrapper.getGraph().values()].flatMap((node) => toCssPurgeIR((node as CssGraphNode).rules));

  const cssClasses = new Set<string>();
  for (const rule of cssRules) {
    for (const className of rule.classes) cssClasses.add(className);
  }

  const usedClasses = extractUsedClasses(jsxNodes, cssClasses);
  const classes = summarize(usedClasses, cssClasses);

  const allVars = new Set<string>();
  for (const rule of cssRules) {
    for (const varName of rule.declaredVars) allVars.add(varName);
    for (const varName of rule.referencedVars) allVars.add(varName);
  }
  const usedVars = extractUsedVars(cssRules, usedClasses);
  const vars = summarize(usedVars, allVars);

  ctx.info(`[purgeon] CSS classes: ${classes.usedCount} used, ${classes.unusedCount} unused (of ${classes.total} total)`);
  ctx.info(`[purgeon] CSS vars: ${vars.usedCount} used, ${vars.unusedCount} unused (of ${vars.total} total)`);

  return { classes, vars, usedClasses, usedVars };
}

function purgeBundle(bundle: OutputBundle, usedClasses: Set<string>, usedVars: Set<string>): void {
  for (const fileName in bundle) {
    const output = bundle[fileName]!;
    if (output.type !== "asset" || !fileName.endsWith(".css")) continue;

    const source = typeof output.source === "string" ? output.source : Buffer.from(output.source).toString("utf-8");
    output.source = purgeUnusedCss(source, fileName, usedClasses, usedVars);
  }
}

function resolveDebugOutFile(debug?: boolean | { outFile: string }): string | null {
  if (!debug) return null;
  if (typeof debug === "object") return debug.outFile;
  return "graph.json";
}

export interface PluginOptions {
  plugins?: AnalyzerPlugin[];
  debug?: boolean | { outFile: string };
}
