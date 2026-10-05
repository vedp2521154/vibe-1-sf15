# Internal Mobility Desk

A lightweight ride-coordination MVP for one campus Toto. Students and employees request rides, a rider manages pickup and completion, and completed trips stay available in history.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- MongoDB Atlas with the official MongoDB Node.js driver

## Roles and workflow

Users sign in with a username and password. Their assigned active role determines which workspace they can access. Requester accounts can self-register using an active requester role; Rider and Admin accounts are created by an Admin. Rides support multiple passengers, scheduled durations, overlap handling, waitlists, cancellation, completion, and history.

**Request → Accept / Clash → Boarded / Missed → Complete → History**

## Run locally

1. Install Node.js 20.9 or newer and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `MONGODB_URI` to your MongoDB Atlas connection string and set `MONGODB_DB=mobility_desk` in `.env.local`.
5. Set `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD` (at least 10 characters), and `BOOTSTRAP_ADMIN_NAME` in `.env.local` to create the first Admin account on the first sign-in attempt. The bootstrap is idempotent and will not overwrite an existing account's password. Do not use a shared or weak password.
6. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

`.env.local` is ignored by Git. Keep the MongoDB URI and bootstrap credentials out of committed files. After the first Admin account is created, the bootstrap variables may be removed; resetting them will not change an existing user's password.

## Authentication and authorization

- Passwords are hashed with Node.js `crypto.scrypt`; plaintext passwords are never stored or returned.
- Sign-in creates a seven-day MongoDB-backed session. The browser receives only a random token in the `HttpOnly`, `SameSite=Lax` `mobility_session` cookie; MongoDB stores its SHA-256 hash. The cookie is marked `Secure` in production.
- The server resolves each session to an active user and an active configured role. Client storage, role query parameters, and `x-mobility-role` headers do not grant permissions.
- Requester registration is restricted server-side to active roles in the requester category. Admin/Rider accounts are created and managed from **Admin → Users**.
- User and session indexes are created automatically, including a unique normalized username index and TTL cleanup for expired sessions.
- Required environment variables: `MONGODB_URI`, `MONGODB_DB`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, and `BOOTSTRAP_ADMIN_NAME`. Configure the same variables in Vercel Environment Variables for each deployed environment. The app does not deploy itself.

## Checks

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` before deploying.
