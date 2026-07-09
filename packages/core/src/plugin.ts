import { type GraphNode, ModuleGraph } from "./graph";

declare const __pluginName: unique symbol;

export type PluginName = string & { readonly [__pluginName]: void };

export const pluginName = (name: string): PluginName => name as PluginName;

export interface ParseContext {
  parse(code: string, options: { lang: string; sourceType: string }): unknown;
}

export interface ModuleParsedInfo {
  id: string;
  importedIds: readonly string[];
}

export interface OutputAsset {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
}

export interface OutputChunk {
  type: "chunk";
  fileName: string;
  code: string;
}

export type OutputBundle = Record<string, OutputAsset | OutputChunk>;

export abstract class AnalyzerPlugin<TNode extends GraphNode = GraphNode> {
  abstract readonly name: PluginName;

  protected readonly graph = new ModuleGraph<TNode>();
  protected readonly astById = new Map<string, unknown>();
  protected readonly codeById = new Map<string, string>();

  protected abstract isModuleSupported(id: string): boolean;
  protected abstract createNode(id: string): TNode;
  protected abstract parseModule(code: string, id: string, ctx: ParseContext): unknown;
  protected abstract analyzeModule(id: string, ast: unknown, code: string, node: TNode): void;

  protected analyzeBundle(_bundle: OutputBundle): void {}

  getGraph(): ModuleGraph<TNode> {
    return this.graph;
  }

  toRolldownPlugin(): {
    name: PluginName;
    transform: (this: ParseContext, code: string, id: string) => null;
    moduleParsed: (moduleInfo: ModuleParsedInfo) => void;
    generateBundle: (options: unknown, bundle: OutputBundle) => void;
  } {
    return ((self: AnalyzerPlugin<TNode>) => ({
      name: self.name,

      transform(this: ParseContext, code: string, id: string): null {
        if (!self.isModuleSupported(id)) return null;

        const ast = self.parseModule(code, id, this);
        self.astById.set(id, ast);
        self.codeById.set(id, code);

        const node = self.graph.ensureNode(id, (nodeId: string) => self.createNode(nodeId));
        self.analyzeModule(id, ast, code, node);

        return null;
      },

      moduleParsed(moduleInfo: ModuleParsedInfo): void {
        for (const importedId of moduleInfo.importedIds) {
          if (self.isModuleSupported(importedId)) {
            self.graph.ensureNode(importedId, (id: string) => self.createNode(id)).importers.push(moduleInfo.id);
          }
        }

        if (!self.isModuleSupported(moduleInfo.id)) return;

        const node = self.graph.ensureNode(moduleInfo.id, (id: string) => self.createNode(id));
        node.imports = [...moduleInfo.importedIds];

        const ast = self.astById.get(moduleInfo.id);
        const code = self.codeById.get(moduleInfo.id);
        if (!ast || code === undefined) return;

        self.analyzeModule(moduleInfo.id, ast, code, node);
      },

      generateBundle(_options: unknown, bundle: OutputBundle): void {
        self.analyzeBundle(bundle);
      },
    }))(this);
  }
}

export const isAnalyzer = (p: unknown): p is AnalyzerPlugin => p instanceof AnalyzerPlugin;
