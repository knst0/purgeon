export interface GraphNode {
  id: string;
  imports: string[];
  importers: string[];
}

export class ModuleGraph<TNode extends GraphNode = GraphNode> {
  private readonly nodes = new Map<string, TNode>();

  ensureNode(id: string, create: (id: string) => TNode): TNode {
    let node = this.nodes.get(id);
    if (!node) {
      node = create(id);
      this.nodes.set(id, node);
    }
    return node;
  }

  get(id: string): TNode | undefined {
    return this.nodes.get(id);
  }

  values(): IterableIterator<TNode> {
    return this.nodes.values();
  }

  toObject(): Record<string, TNode> {
    return Object.fromEntries(this.nodes);
  }
}
