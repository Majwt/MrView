# Adding Pages

This project uses route-object modules and a pages-plus-features structure.

## Quick checklist

1. Copy `src/templates/page-feature-template` into your target feature/page folders.
2. Rename the copied feature folder from `new-feature` to your feature slug.
3. Add your page under `src/pages/<feature>/`.
4. Register the new route in `src/app/router/feature-routes.tsx`.
5. If needed, wrap route elements with `AdminRoute` in `src/app/router/routes.tsx`.
6. Add navigation links in `src/features/navigation/ui/app-sidebar.tsx`.
7. Run validation:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Route guard patterns

- Public route: add route outside protected shell.
- Protected route: add to `protectedChildRoutes`.
- Admin-only route: add to `adminChildRoutes` and keep `AdminRoute` wrapping in `routes.tsx`.
