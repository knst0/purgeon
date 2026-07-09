import { AnalyzerPlugin, pluginName, type ParseContext, type PluginName } from "@purgeon/core";
import { walk } from "oxc-walker";

import {
  collectImportBindings,
  collectStaticExports,
  extractProps,
  getCalleeName,
  getJSXElementName,
  resolveCssModuleRef,
  sourceOf,
  tryStaticEval,
  tryStaticEvalPartial,
} from "./ast-utils";
import type { JsxAnalyzerOptions, JsxGraphNode } from "./jsx-node";

const DEFAULT_TRACKED_CALLS = ["cva", "cx", "cn", "tv", "clsx"];

export class JsxAnalyzer extends AnalyzerPlugin<JsxGraphNode> {
  readonly name: PluginName = pluginName("jsx-graph");

  private readonly trackedCalls: Set<string>;

  constructor(options: JsxAnalyzerOptions = {}) {
    super();
    this.trackedCalls = new Set(options.trackedCalls ?? DEFAULT_TRACKED_CALLS);
  }

  protected isModuleSupported(id: string): boolean {
    return /\.[jt]sx?$/.test(id);
  }

  protected parseModule(code: string, id: string, ctx: ParseContext): unknown {
    return ctx.parse(code, {
      lang: id.endsWith("x") ? (id.endsWith(".tsx") ? "tsx" : "jsx") : "ts",
      sourceType: "module",
    });
  }

  protected createNode(id: string): JsxGraphNode {
    return {
      id,
      imports: [],
      importers: [],
      jsxUsages: [],
      classVariantCalls: [],
      styledComponentUsages: [],
      importBindings: {},
      staticExports: {},
    };
  }

  protected analyzeModule(_id: string, ast: unknown, code: string, node: JsxGraphNode): void {
    const importBindings = collectImportBindings(ast);
    node.importBindings = Object.fromEntries(importBindings);
    node.staticExports = collectStaticExports(ast);

    const resolveCssExpr = (expr: any) => {
      const ref = resolveCssModuleRef(expr, importBindings);
      return ref ? { kind: "css-module-ref", value: ref } : null;
    };

    walk(ast as Parameters<typeof walk>[0], {
      enter: (n) => {
        if (n.type === "JSXOpeningElement") {
          const name = getJSXElementName(n.name);
          const binding = name ? importBindings.get(name) : undefined;
          node.jsxUsages.push({
            component: name,
            resolvedFrom: binding ? binding.source : null,
            props: extractProps(n.attributes, code, resolveCssExpr),
          });
          return;
        }

        if (n.type === "CallExpression") {
          const calleeName = getCalleeName(n.callee);
          if (calleeName && this.trackedCalls.has(calleeName)) {
            const configResult = tryStaticEval(n.arguments[0]);
            node.classVariantCalls.push({
              name: calleeName,
              static: configResult.ok,
              config: configResult.ok ? configResult.value : tryStaticEvalPartial(n.arguments[0]),
              rawCode: configResult.ok ? null : sourceOf(n, code),
            });
          }
          return;
        }

        if (n.type === "TaggedTemplateExpression") {
          const tag = n.tag;
          if (tag.type === "MemberExpression" && tag.object.type === "Identifier" && tag.object.name === "styled") {
            const baseTag = tag.property.type === "Identifier" ? tag.property.name : null;
            node.styledComponentUsages.push({ baseTag, kind: "element" });
          } else if (tag.type === "CallExpression" && tag.callee.type === "Identifier" && tag.callee.name === "styled") {
            const arg = tag.arguments[0];
            const baseTag = arg && arg.type === "Identifier" ? arg.name : null;
            node.styledComponentUsages.push({ baseTag, kind: "component" });
          }
        }
      },
    });
  }
}
