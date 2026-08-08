<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Cursor Cloud specific instructions

- Package manager is **Bun** (`bun.lock`, `bunfig.toml`) — not npm. Use `bun install` / `bun run <script>`. `bunfig.toml` enforces a 24h `minimumReleaseAge` supply-chain guard, so brand-new package versions are skipped on install.
- Scripts live in `package.json`: `bun run dev` (Vite dev server), `bun run build` (Vite + Nitro build), `bun run lint` (ESLint), `bun run format` (Prettier). There is no automated test framework/`test` script.
- The dev server listens on **port 8080** (`http://localhost:8080/`), not Vite's default 5173. Port/host/strictPort come from `@lovable.dev/vite-tanstack-config`; do not add TanStack/tailwind/nitro plugins manually in `vite.config.ts` (the shared config already includes them).
- `bun run lint` currently reports thousands of pre-existing `prettier/prettier` errors in committed code. This is the repo's baseline, not an environment problem — do not mass-reformat unless asked.
- **Auth is dev-bypassed for local development.** `src/components/RouteGuard.tsx` and `src/store/authStore.ts` always mount a fake `super_admin` ("Dev Super Admin"), so no Supabase magic-link login is needed to reach `/dashboard`, `/candidates`, `/candidates/new`, etc. The Supabase project is remote and configured via committed `VITE_SUPABASE_*` vars in `.env`; no local Supabase instance is required.
- Candidate detail opens as a query-param modal from the list (`/candidates?open=<id>`); visiting `/candidates/:id` directly with mock IDs shows "Candidate not found". This is expected behavior, not a bug.
