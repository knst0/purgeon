# purgeon

Removes unused CSS classes and custom properties from bundled output. Works with rolldown/vite.

## Packages

- `@purgeon/core` — plugin base classes, module graph, purge-css engine, used-classes/used-vars extractors
- `@purgeon/analyzer-css` — walks bundled CSS (lightningcss visitor), builds class co-occurrence and custom-property graphs
- `@purgeon/analyzer-jsx` — walks JSX AST (oxc-walker), tracks element usages and class-variant calls (cva/cn/cx/tv/clsx)
- `@purgeon/rolldown-plugin` — `purgeon()` plugin that wires analyzers together and purges unused rules from emitted CSS

## Usage

```sh
npm i -D @purgeon/rolldown-plugin @purgeon/analyzer-css @purgeon/analyzer-jsx
```

```sh
pnpm add -D @purgeon/rolldown-plugin @purgeon/analyzer-css @purgeon/analyzer-jsx
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { purgeon } from "@purgeon/rolldown-plugin";
import { cssAnalyzer } from "@purgeon/analyzer-css";
import { jsxAnalyzer } from "@purgeon/analyzer-jsx";

export default defineConfig({
  plugins: [
    // purgeon must run first — framework compilers (solid(), @vitejs/plugin-react) rewrite JSX into runtime calls, destroying the JSX nodes analyzer-jsx looks for
    purgeon({ plugins: [cssAnalyzer(), jsxAnalyzer()] }),
    solid(),
  ],
});
```

## How it works

1. `transform` / `moduleParsed` — analyzers walk modules, building usage graphs
2. `generateBundle` — cross-reference JSX usage against CSS graphs, purge unused rules
3. `writeBundle` — emit debug output
