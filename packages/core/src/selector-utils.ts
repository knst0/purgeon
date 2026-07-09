import type { Selector, SelectorComponent } from "lightningcss";

export function splitCompoundSelectors(selector: Selector): SelectorComponent[][] {
  const groups: SelectorComponent[][] = [[]];

  for (const component of selector) {
    if (component.type === "combinator") {
      groups.push([]);
      continue;
    }
    groups[groups.length - 1]!.push(component);
  }

  return groups.filter((group) => group.length > 0);
}

export function classesOf(components: SelectorComponent[]): string[] {
  const result = new Set<string>();

  for (const component of components) {
    if (component.type === "class") {
      result.add(component.name);
      continue;
    }

    if (component.type === "pseudo-class" && (component.kind === "is" || component.kind === "where" || component.kind === "has")) {
      for (const nestedSelector of component.selectors) {
        for (const group of splitCompoundSelectors(nestedSelector)) {
          for (const className of classesOf(group)) {
            result.add(className);
          }
        }
      }
    }
  }

  return [...result];
}
