# @purgeon/rolldown-plugin

## 0.2.0

### Minor Changes

- fd65621: Add data-attribute purge support. JSX `data-*` attribute usages are now tracked and cross-referenced against `[data-*]` CSS attribute selectors, so rules scoped to `[data-state="open"]`-style selectors are purged when unused. Static literal values are matched exactly; a `data-x={props.color}`-style prop-forwarding value is narrowed using literal usages of that prop name elsewhere in the app (same model as cva/tv variant narrowing); other dynamic/expression values conservatively keep all selectors for that attribute name alive.

  Also fixes CSS custom-property purging: `extractUsedVars` previously treated any rule without a class selector as unconditionally live, so `[data-*]`-scoped rules (and any custom properties they referenced) were never purged regardless of actual usage. Rules are now scoped by class **or** data-attribute keys.

### Patch Changes

- Updated dependencies [fd65621]
  - @purgeon/core@0.2.0
  - @purgeon/analyzer-css@0.2.0
  - @purgeon/analyzer-jsx@0.2.0
