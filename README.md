# Bots Battle

A pirate ship strategy game where bots written in Python, C#, Java, Kotlin, or Swift battle for supremacy.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **PostgreSQL** database (Neon, Supabase, or local)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js (min 32 chars — run `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Base URL of the app (`http://localhost:3200` locally) |
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

### Creating OAuth Credentials

**GitHub:** Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New OAuth App
- Homepage URL: `http://localhost:3200`
- Callback URL: `http://localhost:3200/api/auth/callback/github`

**Google:** Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth Client ID
- Authorized redirect URI: `http://localhost:3200/api/auth/callback/google`

## Local Development

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start dev server (port 3200)
pnpm dev
```

Open [http://localhost:3200](http://localhost:3200).

## Database

```bash
# Generate migration files from schema changes
pnpm db:generate

# Push schema directly to database (dev only)
pnpm db:push

# Open Drizzle Studio (visual DB browser)
pnpm db:studio
```

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com/new)
3. Set root directory to `app/`
4. Add all environment variables from `.env.example` in the Vercel dashboard
5. Set `NEXTAUTH_URL` to your production URL (e.g., `https://bots-battle.vercel.app`)
6. Deploy — Vercel will use `vercel.json` for build config

The app is configured with:
- **Region:** `iad1` (US East — closest to NYC)
- **Output:** `standalone` (optimized Docker-compatible build)
- **Runtime:** Node.js 20

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** NextAuth.js v5
- **Database:** PostgreSQL + Drizzle ORM
- **UI:** Tailwind CSS + shadcn/ui
- **Bot Sandboxes:** isolated-vm, Brython, custom runtimes
- **Testing:** Vitest
