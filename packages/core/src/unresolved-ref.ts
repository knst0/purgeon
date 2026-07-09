/** Marker for unresolved identifiers from tryStaticEvalPartial.
 *  Consumers with cross-module context can resolve via importBindings + staticExports. */
export const UNRESOLVED_REF_KEY = "__purgeonUnresolvedRef";

export interface UnresolvedRef {
  [UNRESOLVED_REF_KEY]: string;
}
