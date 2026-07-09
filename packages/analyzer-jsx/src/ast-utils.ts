import { UNRESOLVED_REF_KEY, type UnresolvedRef } from "@purgeon/core";
import { walk } from "oxc-walker";

function getPropKeyName(key: any): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
}

/** Extracts a JSX element name: <Foo />, <Foo.Bar />, <ns:Foo /> */
export function getJSXElementName(nameNode: any): string | null {
  if (!nameNode) return null;
  switch (nameNode.type) {
    case "JSXIdentifier":
      return nameNode.name;
    case "JSXMemberExpression":
      return `${getJSXElementName(nameNode.object)}.${getJSXElementName(nameNode.property)}`;
    case "JSXNamespacedName":
      return `${nameNode.namespace.name}:${nameNode.name.name}`;
    default:
      return nameNode.name ?? null;
  }
}

/** Returns the source text of a node based on its position in the code. */
export function sourceOf(node: any, code: string): string | null {
  if (!node || typeof node.start !== "number" || typeof node.end !== "number") {
    return null;
  }
  return code.slice(node.start, node.end);
}

/** Static eval of an AST node → plain JS value. Returns { ok: false } for dynamic nodes. */
export function tryStaticEval(node: any): { ok: boolean; value?: any } {
  if (!node) return { ok: false };

  switch (node.type) {
    case "Literal":
      return { ok: true, value: node.value };

    case "TemplateLiteral":
      if (node.expressions?.length) return { ok: false };
      return { ok: true, value: node.quasis.map((q: any) => q.value.cooked ?? q.value.raw).join("") };

    case "ArrayExpression": {
      const values: any[] = [];
      for (const el of node.elements) {
        if (el === null) {
          values.push(undefined);
          continue;
        }
        const result = tryStaticEval(el);
        if (!result.ok) return { ok: false };
        values.push(result.value);
      }
      return { ok: true, value: values };
    }

    case "ObjectExpression": {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (prop.type !== "Property" || prop.computed) return { ok: false };

        const keyName = getPropKeyName(prop.key);
        if (keyName === null) return { ok: false };

        const valueResult = tryStaticEval(prop.value);
        if (!valueResult.ok) return { ok: false };
        obj[keyName] = valueResult.value;
      }
      return { ok: true, value: obj };
    }

    case "UnaryExpression": {
      if (node.operator === "-") {
        const argResult = tryStaticEval(node.argument);
        if (!argResult.ok || typeof argResult.value !== "number") return { ok: false };
        return { ok: true, value: -argResult.value };
      }
      return { ok: false };
    }

    case "TSAsExpression":
    case "TSSatisfiesExpression":
      return tryStaticEval(node.expression);

    default:
      return { ok: false };
  }
}

/** Partial static eval: never bails on the whole structure for one dynamic sibling.
 *  Unresolvable → undefined; bare identifiers → UnresolvedRef marker. */
export function tryStaticEvalPartial(node: any): any {
  if (!node) return undefined;

  switch (node.type) {
    case "Literal":
      return node.value;

    case "Identifier":
      return { [UNRESOLVED_REF_KEY]: node.name } satisfies UnresolvedRef;

    case "TemplateLiteral":
      if (node.expressions?.length) return undefined;
      return node.quasis.map((q: any) => q.value.cooked ?? q.value.raw).join("");

    case "ArrayExpression":
      return node.elements.map((el: any) => (el === null ? undefined : tryStaticEvalPartial(el)));

    case "ObjectExpression": {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (prop.type !== "Property" || prop.computed) continue;

        const keyName = getPropKeyName(prop.key);
        if (keyName === null) continue;

        obj[keyName] = tryStaticEvalPartial(prop.value);
      }
      return obj;
    }

    case "UnaryExpression": {
      if (node.operator !== "-") return undefined;
      const argValue = tryStaticEvalPartial(node.argument);
      return typeof argValue === "number" ? -argValue : undefined;
    }

    case "TSAsExpression":
    case "TSSatisfiesExpression":
      return tryStaticEvalPartial(node.expression);

    default:
      return undefined;
  }
}

/** Extracts the callee name of a CallExpression, to check it against tracked function names. */
export function getCalleeName(callee: any): string | null {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
    return callee.property.name;
  }
  return null;
}

/** `export const X = ...` values, keyed by exported name, for cross-module ref resolution. */
export function collectStaticExports(ast: any): Record<string, unknown> {
  const exports: Record<string, unknown> = {};

  for (const statement of ast.body ?? ast.program?.body ?? []) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration") continue;

    for (const declarator of statement.declaration.declarations) {
      if (declarator.id.type !== "Identifier" || !declarator.init) continue;
      exports[declarator.id.name] = tryStaticEvalPartial(declarator.init);
    }
  }

  return exports;
}

/** Extracts { localName -> importSource } from the module's import declarations. */
export function collectImportBindings(ast: any) {
  const bindings = new Map<string, { source: string; imported: string }>();

  walk(ast, {
    enter(node: any) {
      if (node.type !== "ImportDeclaration") return;
      const source = node.source.value;
      for (const spec of node.specifiers ?? []) {
        if (spec.type === "ImportDefaultSpecifier") {
          bindings.set(spec.local.name, { source, imported: "default" });
        } else if (spec.type === "ImportSpecifier") {
          bindings.set(spec.local.name, { source, imported: (spec.imported as any).name });
        } else if (spec.type === "ImportNamespaceSpecifier") {
          bindings.set(spec.local.name, { source, imported: "*" });
        }
      }
    },
  });

  return bindings;
}

/** Resolves styles.foo / styles["foo"] → "<specifier>::<className>". Returns null if not a CSS Modules ref. */
export function resolveCssModuleRef(expr: any, importBindings: Map<string, { source: string; imported: string }>): string | null {
  if (expr.type !== "MemberExpression") return null;
  if (expr.object?.type !== "Identifier") return null;

  const binding = importBindings.get(expr.object.name);
  if (!binding) return null;
  if (!binding.source.endsWith(".module.css")) return null;
  if (binding.imported !== "default") return null;

  let propName: string | null = null;
  if (!expr.computed && expr.property?.type === "Identifier") {
    propName = expr.property.name;
  } else if (expr.computed && expr.property?.type === "Literal" && typeof expr.property.value === "string") {
    propName = expr.property.value;
  }
  if (propName === null) return null;

  return `${binding.source}::${propName}`;
}

/** Extracts JSX props to serializable form. Optional resolveExpr hook for custom resolution (e.g. CSS Modules). */
export function extractProps(attributes: any[], code: string, resolveExpr?: (expr: any) => { kind: string; value: unknown } | null) {
  return attributes.map((attr: any) => {
    if (attr.type === "JSXSpreadAttribute") {
      return { name: "...spread", kind: "spread", code: sourceOf(attr.argument, code) };
    }

    const name = attr.name.name ?? getJSXElementName(attr.name);

    if (attr.value == null) {
      return { name, kind: "literal", value: true };
    }

    if (attr.value.type === "JSXExpressionContainer") {
      const expr = attr.value.expression;

      if (resolveExpr) {
        const resolved = resolveExpr(expr);
        if (resolved) return { name, ...resolved };
      }

      const staticResult = tryStaticEval(expr);
      return staticResult.ok ? { name, kind: "literal", value: staticResult.value } : { name, kind: "expr", code: sourceOf(expr, code) };
    }

    return { name, kind: "literal", value: attr.value.value };
  });
}
