export class ClassGraph {
  private readonly edges = new Map<string, Set<string>>();

  private ensure(className: string): Set<string> {
    let neighbors = this.edges.get(className);
    if (!neighbors) {
      neighbors = new Set();
      this.edges.set(className, neighbors);
    }
    return neighbors;
  }

  addClass(className: string): void {
    this.ensure(className);
  }

  addCoOccurrence(a: string, b: string): void {
    if (a === b) return;
    this.ensure(a).add(b);
    this.ensure(b).add(a);
  }

  neighbors(className: string): Set<string> | undefined {
    return this.edges.get(className);
  }

  classes(): IterableIterator<string> {
    return this.edges.keys();
  }

  toObject(): Record<string, string[]> {
    return Object.fromEntries([...this.edges].map(([className, neighbors]) => [className, [...neighbors]]));
  }
}
