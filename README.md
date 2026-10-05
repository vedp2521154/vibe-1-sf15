# Internal Mobility Desk

Internal Mobility Desk coordinates shared rides for a single institutional vehicle, such as a campus Toto. It replaces informal requests with one operational queue and a clear trip history.

## Core workflow

**Request → Scheduling → Pending / Waitlist → Rider Accept → Boarded / Missed → Complete → History**

The request scheduler checks the vehicle's configured capacity and schedule overlap. Conflicting requests wait for an open slot and return to the rider queue when one becomes available.

## Roles

- **Requester**: registers with an active requester role, creates and manages their own ride requests, and sees personal history and notifications.
- **Rider**: reviews requests, accepts rides, records passenger pickup outcomes, and completes trips.
- **Admin / Mobility Desk**: manages users, dynamic requester roles, locations, vehicle settings, history, archives, analytics, and activity visibility.

## Features

- Username and password accounts with server-side authorization
- Dynamic requester roles and pickup/drop locations
- Configurable vehicle name and passenger capacity
- Scheduled trip duration, estimated end time, overlap detection, and waitlist promotion
- Cancellation, rider acceptance, boarded/missed tracking, and trip completion
- Personal history, rider/admin history, search, filters, pagination, archive, restore, and admin-only permanent deletion
- Admin analytics with date ranges, status/passenger counts, common routes, peak request time, completion/boarding rates, and daily activity
- Private in-app notifications for meaningful ride events
- Admin audit activity for ride, user, role, location, and settings changes
- Responsive light/dark theme
- Installable PWA manifest and app icons; offline banner explains that server features require connectivity

The PWA does not cache authenticated API responses or queue ride operations offline. Database-backed features require an internet connection.

## Tech stack and architecture

- Next.js App Router
- TypeScript
- Tailwind CSS
- MongoDB Atlas with the official MongoDB Node.js driver
- Vercel (deployment platform)

```text
Browser
  ↓
Next.js pages and authenticated Route Handlers
  ↓
MongoDB Atlas
```

## Local setup

1. Install Node.js 20.9 or newer and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill in the required values below.
5. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

`.env.local` is ignored by Git. Never commit MongoDB credentials or account passwords. An Admin account can create Rider and other managed accounts from **Admin → Users**.

## Environment variables

| Name | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | Database name |
| `BOOTSTRAP_ADMIN_USERNAME` | Username for first Admin creation |
| `BOOTSTRAP_ADMIN_PASSWORD` | Strong password for first Admin creation (at least 10 characters) |
| `BOOTSTRAP_ADMIN_NAME` | Display name for first Admin |

The bootstrap variables are only used when no active Admin account exists. They do not reset an existing account's password. Configure the required values in the deployment platform's server-side environment settings. `.env.example` contains placeholders only.

## Authentication and data security

- Passwords are hashed with Node.js `crypto.scrypt`; plaintext passwords are not stored.
- Sessions are stored in MongoDB. The browser receives a random token in a seven-day `HttpOnly`, `SameSite=Lax` cookie, marked `Secure` in production; MongoDB stores only its SHA-256 hash.
- The server resolves each request's user and active role. Client-side role selection and identifiers do not grant access.
- Registration permits active requester roles only. Rider and Admin accounts are provisioned by an Admin.
- Notification endpoints scope every read and update to the signed-in user's server-verified ID. Admin analytics and audit activity are Admin-only.
- Analytics, activity, notifications, rides, and account APIs are not cached by the PWA. There is no service worker or offline write queue.

## Checks

Run the project's checks before shipping changes:

```sh
npm run lint
npx tsc --noEmit
npm run build
```
