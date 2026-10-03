# Internal Mobility Desk

A lightweight ride-coordination MVP for one campus Toto. Students and employees request rides, a rider manages pickup and completion, and completed trips stay available in history.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- MongoDB Atlas with the official MongoDB Node.js driver

## Roles and workflow

Choose a role when signing in: **Student**, **Employee**, or **Rider**. Student and employee requests support multiple passengers. The rider accepts one request, same-time requests become clashes, passengers are marked boarded or missed, and the trip can then be completed.

**Request → Accept / Clash → Boarded / Missed → Complete → History**

## Run locally

1. Install Node.js 20.9 or newer and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `MONGODB_URI` to your MongoDB Atlas connection string and set `MONGODB_DB=mobility_desk` in `.env.local`.
5. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

`.env.local` is ignored by Git. Keep the real MongoDB URI and password out of committed files.

## Checks

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` before deploying. For Vercel, configure `MONGODB_URI` and `MONGODB_DB` in the project's Environment Variables for each target environment. The app does not deploy itself.

Login stores only a name and role in browser localStorage. It is a development/demo session, not production identity verification; production use requires server-backed authentication and authorization.
