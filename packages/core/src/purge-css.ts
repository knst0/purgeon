import { transform, type Location2 } from "lightningcss";

import { createClassLivenessStrategy, createVarLivenessStrategy } from "./purge-strategy";

function computeLineStarts(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
  }
  return starts;
}

function offsetOf(lineStarts: number[], loc: Location2): number {
  return (lineStarts[loc.line] ?? 0) + (loc.column - 1);
}

function findRuleEnd(code: string, start: number): number {
  const braceStart = code.indexOf("{", start);
  if (braceStart === -1) return -1;

  let depth = 0;
  for (let i = braceStart; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Drops dead class-scoped rules and unused custom-property declarations.
 *  Slices exact source ranges — output is byte-identical to input except removed spans. */
export function purgeUnusedCss(
  code: string,
  filename: string,
  usedClasses: ReadonlySet<string>,
  usedVars: ReadonlySet<string> = new Set(),
): string {
  const lineStarts = computeLineStarts(code);
  const ranges: [number, number][] = [];

  const classStrategy = createClassLivenessStrategy();
  const varStrategy = createVarLivenessStrategy(usedVars);

  transform({
    filename,
    code: Buffer.from(code),
    visitor: {
      Rule: {
        style: (rule) => {
          const keys = classStrategy.collectKeys(rule.value);
          const start = offsetOf(lineStarts, rule.value.loc);

          if (keys.length > 0) {
            if (keys.some((c) => usedClasses.has(c))) return;

            const end = findRuleEnd(code, start);
            if (end !== -1) ranges.push([start, end]);
            return;
          }

          const end = findRuleEnd(code, start);
          if (end === -1) return;

          const braceIndex = code.indexOf("{", start);
          const bodyStart = braceIndex + 1;
          const bodyEnd = end - 1;
          ranges.push(...varStrategy.collectDeadRanges(code.slice(bodyStart, bodyEnd), bodyStart));
        },
      },
    },
  });

  ranges.sort((a, b) => b[0] - a[0]);

  let result = code;
  for (const [start, end] of ranges) result = result.slice(0, start) + result.slice(end);
  return result;
}
