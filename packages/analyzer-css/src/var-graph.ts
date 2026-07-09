export class VarGraph {
  private readonly declaredIn = new Map<string, Set<string>>();
  private readonly referencedIn = new Map<string, Set<string>>();
  private readonly dependsOn = new Map<string, Set<string>>();
  private readonly usedBy = new Map<string, Set<string>>();

  private ensure(map: Map<string, Set<string>>, key: string): Set<string> {
    let values = map.get(key);
    if (!values) {
      values = new Set();
      map.set(key, values);
    }
    return values;
  }

  declare(varName: string, moduleId: string): void {
    this.ensure(this.declaredIn, varName).add(moduleId);
  }

  reference(varName: string, moduleId: string, declaringVar?: string): void {
    this.ensure(this.referencedIn, varName).add(moduleId);

    if (declaringVar && declaringVar !== varName) {
      this.ensure(this.dependsOn, declaringVar).add(varName);
      this.ensure(this.usedBy, varName).add(declaringVar);
    }
  }

  declaredModules(varName: string): Set<string> | undefined {
    return this.declaredIn.get(varName);
  }

  referencingModules(varName: string): Set<string> | undefined {
    return this.referencedIn.get(varName);
  }

  dependenciesOf(varName: string): Set<string> | undefined {
    return this.dependsOn.get(varName);
  }

  dependentsOf(varName: string): Set<string> | undefined {
    return this.usedBy.get(varName);
  }

  toObject(): {
    declaredIn: Record<string, string[]>;
    referencedIn: Record<string, string[]>;
    dependsOn: Record<string, string[]>;
  } {
    return {
      declaredIn: toRecord(this.declaredIn),
      referencedIn: toRecord(this.referencedIn),
      dependsOn: toRecord(this.dependsOn),
    };
  }
}

function toRecord(map: Map<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries([...map].map(([key, values]) => [key, [...values]]));
}
