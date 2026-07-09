import {
  AnalyzerPlugin,
  classesOf,
  pluginName,
  splitCompoundSelectors,
  type OutputBundle,
  type ParseContext,
  type PluginName,
} from "@purgeon/core";
import { transform } from "lightningcss";

import { ClassGraph } from "./class-graph";
import type { CssAnalyzerOptions, CssGraphNode, CssRule, CssVarDeclaration } from "./css-node";
import { VarGraph } from "./var-graph";

function normalizeModuleId(id: string): string {
  return id.replace(/\?.*$/, "").replace(/\\/g, "/");
}

export class CssAnalyzer extends AnalyzerPlugin<CssGraphNode> {
  readonly name: PluginName = pluginName("css-graph");

  private readonly classGraph = new ClassGraph();
  private readonly varGraph = new VarGraph();

  constructor(private readonly options: CssAnalyzerOptions = {}) {
    super();
  }

  getClassGraph(): ClassGraph {
    return this.classGraph;
  }

  getVarGraph(): VarGraph {
    return this.varGraph;
  }

  protected isModuleSupported(id: string): boolean {
    return id.endsWith(".module.css");
  }

  protected parseModule(code: string, _id: string, _ctx: ParseContext): unknown {
    return code;
  }

  protected createNode(id: string): CssGraphNode {
    return { id, imports: [], importers: [], rules: [] };
  }

  protected analyzeModule(id: string, _ast: unknown, code: string, node: CssGraphNode): void {
    if (node.rules.length > 0) return;

    const rawRules = this.parseCss(code, id);
    const normalizedId = normalizeModuleId(id);
    node.rules = rawRules.map((rule) => ({
      ...rule,
      classes: rule.classes.map((cls) => `${normalizedId}::${cls}`),
    }));
  }

  protected analyzeBundle(bundle: OutputBundle): void {
    for (const fileName in bundle) {
      const output = bundle[fileName]!;
      if (output.type !== "asset" || !fileName.endsWith(".css")) continue;

      const source = typeof output.source === "string" ? output.source : Buffer.from(output.source).toString("utf-8");
      const node = this.graph.ensureNode(fileName, (id) => this.createNode(id));
      node.rules = this.parseCss(source, fileName);
    }
  }

  private parseCss(code: string, id: string): CssRule[] {
    const rules: CssRule[] = [];

    let currentRule: CssRule | null = null;
    let currentDeclaredVar: string | null = null;
    let currentVarDeclaration: CssVarDeclaration | null = null;

    transform({
      filename: this.options.filename ?? id,
      code: Buffer.from(code),
      visitor: {
        Rule: {
          style: (rule) => {
            const classes = new Set<string>();

            for (const selector of rule.value.selectors) {
              for (const group of splitCompoundSelectors(selector)) {
                const groupClasses = classesOf(group);
                for (const className of groupClasses) classes.add(className);
                for (let i = 0; i < groupClasses.length; i++) {
                  for (let j = i + 1; j < groupClasses.length; j++) {
                    this.classGraph.addCoOccurrence(groupClasses[i]!, groupClasses[j]!);
                  }
                }
              }
            }

            for (const className of classes) this.classGraph.addClass(className);

            currentRule = {
              classes: [...classes],
              declarations: (rule.value.declarations?.declarations ?? []).map((declaration: { property: string }) => declaration.property),
              declaredVars: [],
              referencedVars: [],
              varDeclarations: [],
            };
            rules.push(currentRule);
          },
        },
        RuleExit: {
          style: () => {
            currentRule = null;
          },
        },
        Declaration: {
          custom: (declaration) => {
            const varName = declaration.name;
            currentDeclaredVar = varName;
            currentRule?.declaredVars.push(varName);
            this.varGraph.declare(varName, id);

            currentVarDeclaration = { name: varName, referencedVars: [] };
            currentRule?.varDeclarations.push(currentVarDeclaration);
          },
        },
        DeclarationExit: {
          custom: () => {
            currentDeclaredVar = null;
            currentVarDeclaration = null;
          },
        },
        Variable: (variable) => {
          const varName = variable.name.ident;
          currentRule?.referencedVars.push(varName);
          currentVarDeclaration?.referencedVars.push(varName);
          this.varGraph.reference(varName, id, currentDeclaredVar ?? undefined);
        },
      },
    });

    return rules;
  }
}
