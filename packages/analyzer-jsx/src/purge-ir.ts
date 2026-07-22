import type { JsxPurgeIRNode, JsxPurgeIRUsage, JsxPurgeIRVariantCall, JsxPurgeIRImportBinding } from "@purgeon/core";

import type { JsxGraphNode, JsxUsage, ClassVariantCall } from "./jsx-node";

export function toJsxPurgeIR(node: JsxGraphNode): JsxPurgeIRNode {
  return {
    id: node.id,
    imports: node.imports,
    jsxUsages: node.jsxUsages.map(
      (usage: JsxUsage): JsxPurgeIRUsage => ({
        props: usage.props.map((prop) => ({
          name: (prop as { name: string }).name,
          kind: (prop as { kind: string }).kind,
          value: (prop as { value?: unknown }).value,
          propRef: (prop as { propRef?: string }).propRef,
          fallback: (prop as { fallback?: string }).fallback,
        })),
      }),
    ),
    classVariantCalls: node.classVariantCalls.map(
      (call: ClassVariantCall): JsxPurgeIRVariantCall => ({
        name: call.name,
        static: call.static,
        config: call.config,
      }),
    ),
    importBindings: Object.fromEntries(
      Object.entries(node.importBindings).map(([key, binding]) => [
        key,
        { source: binding.source, imported: binding.imported } satisfies JsxPurgeIRImportBinding,
      ]),
    ),
    staticExports: node.staticExports,
  } satisfies JsxPurgeIRNode;
}
