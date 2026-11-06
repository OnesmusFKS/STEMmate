# STEMmate

STEMmate is a mobile-first installable web app for preparing, saving, and
managing hands-on STEM activities. Its local workspace uses IndexedDB and
continues to work without a network connection. A Supabase project is optional
for local use and required for secure accounts and cross-device synchronization.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the URL printed by Vite.
4. Run `npm run build` to create the production bundle.
5. Run `npm run typecheck` to check TypeScript separately.
6. Run `npm run preview` to serve the production bundle locally.

The app starts in local-only mode when Supabase environment variables are not
configured. Local profile fields, favourites, downloaded activity IDs, created
activities, and pending changes are stored in the browser's IndexedDB database.
Clearing browser site data removes that local workspace.

## Configure Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's
   public API settings. Never put a service-role key in a `VITE_` variable.
4. Apply `supabase/migrations/20261030000000_stemmate_schema.sql` in the
   Supabase SQL editor or with the Supabase CLI.
5. Enable email/password authentication and set the site's allowed redirect
   URLs to the app's local and deployed origins.
6. Restart Vite after changing environment variables.

The migration creates the profile, activity, category, favourite, download,
progress, and synchronization tables; installs row-level security policies;
creates profiles for new auth users; and seeds the initial public activities.
New accounts receive the facilitator role. An existing trusted operator can
promote an account from the SQL editor:

```sql
update public.profiles
set role = 'administrator'
where email = 'admin@example.com';
```

Keep the Supabase service-role key exclusively on a trusted server. Do not
disable row-level security or expose that key to the browser.

## Offline and synchronization behavior

The app caches its same-origin shell with a service worker and stores activity
content, favourites, offline selections, and a durable change queue in
IndexedDB. With Supabase configured, signed-in users sync activity edits,
deletions, favourites, and offline selections when connectivity is available.
Pending changes are only removed from the local queue after the Supabase
operation succeeds. Conflicting server edits are retained locally and reported
as a synchronization failure; no automatic last-write-wins overwrite is
performed. Conflicts offer choices to keep the device version, use the server
version, or review/edit the device version before retrying.

The service worker is registered by the production build. Use HTTPS (or
localhost) for service-worker support.

## Current boundaries

- The local-only profile is not an authenticated account and does not provide
  access control. Use configured Supabase authentication for accounts.
- Activity creation, edits, and deletes in the local workspace are private to
  that browser. Public publishing and administrator management are not exposed
  in the current UI.
- Profile picture upload, administrator/user-management screens, completion
  sync, and server-side pagination remain to be implemented.
- Offline changes made before signing in are retained in IndexedDB. Review them
  before syncing them to an account on a shared device.
