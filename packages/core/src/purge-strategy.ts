import type { StyleRule } from "lightningcss";

import { classesOf, dataAttrsOf, splitCompoundSelectors } from "./selector-utils";

export interface WholeRuleLivenessStrategy {
  /** Returns liveness keys from selectors. Rule survives iff ≥1 key is live. Empty → delegate. */
  collectKeys(rule: StyleRule): string[];
}

export interface DeclarationLivenessStrategy {
  /** Returns absolute byte-offset ranges of dead declarations in an unscoped rule's block. */
  collectDeadRanges(body: string, bodyOffset: number): [number, number][];
}

/** Returns all class selectors and `[data-*]` attribute selectors referenced by the rule. */
export function createClassLivenessStrategy(): WholeRuleLivenessStrategy {
  return {
    collectKeys(rule: StyleRule): string[] {
      const keys = new Set<string>();
      for (const selector of rule.selectors) {
        for (const group of splitCompoundSelectors(selector)) {
          for (const className of classesOf(group)) keys.add(className);
          for (const attrKey of dataAttrsOf(group)) keys.add(attrKey);
        }
      }
      return [...keys];
    },
  };
}

/** Returns dead `--custom-property` declaration ranges in an unscoped rule's block. */
export function createVarLivenessStrategy(usedVars: ReadonlySet<string>): DeclarationLivenessStrategy {
  return {
    collectDeadRanges(body: string, bodyOffset: number): [number, number][] {
      const ranges: [number, number][] = [];
      const declStartRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;

      let match: RegExpExecArray | null;
      while ((match = declStartRegex.exec(body))) {
        const name = match[1]!;
        if (usedVars.has(name)) continue;

        let i = declStartRegex.lastIndex;
        let depth = 0;
        for (; i < body.length; i++) {
          const char = body[i];
          if (char === "(") depth++;
          else if (char === ")") depth--;
          else if (char === ";" && depth === 0) {
            i++;
            break;
          }
        }

        ranges.push([bodyOffset + match.index, bodyOffset + i]);
      }

      return ranges;
    },
  };
}
