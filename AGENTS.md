## Comments

• No inline comments unless the logic is genuinely non-obvious — names carry the meaning.
• No test narration comments — test function names are the documentation.
• No obvious comments — code should be self-documenting.
• Comments only for: non-obvious logic, business context, TODO/FIXME.

## Style

• Prefer single-purpose functions. Avoid flags that change behavior in branches.
• No default exports — named exports only.
• TypeScript strict mode. No `any` without explicit justification.
• No empty catch blocks. If an error is expected, handle it; if not, re-throw or log it.
• No dead code, commented-out blocks, or `console.log` debug leftovers.
• No unnecessary abstraction — don't wrap a one-liner in a function.

## Tests

• Do not write tests unless explicitly asked.
• Verify changes by compilation and lint: `pnpm check` (tsc --noEmit) and `pnpm lint` (oxlint).

## Project Architecture

Monorepo (pnpm + turborepo). packages/:
• core/ — plugin base classes (AnalyzerPlugin, Analyzer), ModuleGraph, purge-css engine, used-classes/used-vars extractors
• analyzer-css/ — CssAnalyzer: walks bundled CSS via lightningcss visitor, builds class co-occurrence graph and CSS custom-property graphs
• analyzer-jsx/ — JsxAnalyzer: walks JSX AST via oxc-walker, tracks JSX element usages and class-variant (cva/cn/cx/tv/clsx) calls
• rolldown-plugin/ — purgeon(): rolldown/vite plugin that wires analyzers together, cross-references JSX→CSS graphs, purges unused rules from emitted CSS assets

Key flow: transform → moduleParsed → generateBundle (cross-reference → purge) → writeBundle (debug output)

## Anti-Slop Rules

• No AI-generated comments like "This function does X" on obvious functions.
• No verbose JSDoc on internal functions — reserve JSDoc for public API only.
• No "best practice" boilerplate (try/catch wrappers that just re-throw, unnecessary null checks, redundant type assertions).
• No "future-proofing" abstractions — YAGNI.
• No configuration options without a concrete use case.
• No verbose variable names when short ones carry the same meaning in context.
• Delete, don't comment out. Git remembers.
