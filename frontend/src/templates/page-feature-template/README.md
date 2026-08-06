# Page Feature Template

Use this folder as a copy blueprint when creating a new page + feature package.

## Suggested flow

1. Copy the `pages` and `features/new-feature` directories.
2. Rename `new-feature` to your feature slug (kebab-case).
3. Rename components/hooks/types to your feature name.
4. Register routes in `src/app/router/feature-routes.tsx`.
5. Add navigation entry in `src/features/navigation/ui/app-sidebar.tsx` if needed.
6. Run `npm run lint && npm run typecheck && npm run test && npm run build`.

## Naming conventions

- Feature folder: kebab-case (`new-feature`)
- Page component file: kebab-case (`new-feature-page.tsx`)
- Hooks: kebab-case file + camelCase function (`use-new-feature-data.ts` exporting `useNewFeatureData`)
- Types: PascalCase type names
