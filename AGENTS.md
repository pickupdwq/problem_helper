# Repository Guidelines

## Project Structure & Module Organization
This is a small Astro site. Application code lives under `src/`: `src/pages/` contains route entry points, `src/layouts/` contains shared page shells, `src/components/` contains reusable Astro components, and `src/assets/` contains imported build-time assets. Static files served from the site root belong in `public/`, such as `public/favicon.svg`. Build and TypeScript configuration are in `astro.config.mjs` and `tsconfig.json`.

## Build, Test, and Development Commands
Use `pnpm` for all package operations; the lockfile is `pnpm-lock.yaml`.

- `pnpm install` installs dependencies.
- `pnpm dev` starts the Astro dev server, normally at `http://localhost:4321`.
- `pnpm build` creates the production build in `dist/`.
- `pnpm preview` serves the built site locally for verification.
- `pnpm astro -- --help` shows Astro CLI options.

The project requires Node.js `>=22.12.0`, as declared in `package.json`.

## Coding Style & Naming Conventions
Use Astro single-file components with frontmatter imports at the top, markup next, and scoped `<style>` blocks last. Match the current formatting style: tabs for indentation in `.astro` markup and CSS, single quotes in TypeScript/JavaScript imports, and semicolons in frontmatter scripts. Name components and layouts with PascalCase, for example `Welcome.astro` and `Layout.astro`. Keep route files lowercase and URL-oriented, for example `src/pages/index.astro` or `src/pages/about.astro`.

## Testing Guidelines
No test framework is currently configured. For now, verify changes with `pnpm build` and, for UI work, inspect the page with `pnpm dev` or `pnpm preview`. If tests are added, place them near the code they cover or in a clearly named test directory, use descriptive names such as `ComponentName.test.ts`, and add the test command to `package.json`.

## Commit & Pull Request Guidelines
The current history only contains `first commit`, so there is no established convention. Use short, imperative commit messages that describe the change, such as `Add landing page layout` or `Update Astro favicon`. Pull requests should include a brief summary, verification steps run, linked issues when applicable, and screenshots for visible UI changes.

## Agent-Specific Instructions
Keep edits focused and avoid unrelated starter-template cleanup unless it supports the requested change. Do not commit generated output such as `dist/` unless explicitly requested.
