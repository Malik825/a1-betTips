# A1 Predictions

> Expert football predictions, free daily tips, and premium VIP packages � trusted by thousands of winning bettors across Africa.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React + Vite)
- **Database & Auth**: [Supabase](https://supabase.com)
- **Styling**: Tailwind CSS
- **Payments**: Paystack
- **Edge Functions**: Supabase Functions (Deno)

## Features

- ?? **Free Daily Tips** � Expert predictions updated daily across 40+ leagues
- ?? **VIP Packages** � Premium high-odds packages with booking codes
- ?? **Authentication** � Supabase-powered login & registration
- ?? **Admin Console** � Manage fixtures, predictions, packages & settings
- ?? **Responsive** � Fully mobile-friendly dark/light mode UI
- ? **Live Sportybet Odds** � via Edge Function proxy

## Development

You need Node.js and npm � [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd a1predictions
npm install
npm run dev
```

## Environment Variables

Create a `.env` file at the root with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

## Database Setup

Run the SQL scripts in order from the `scripts/` directory via the Supabase SQL editor:

1. `supabase_schema.sql` � Core tables
2. `scripts/sync-profiles.sql`
3. `scripts/setup-rls.sql`
4. `scripts/fix-is-admin.sql`
5. `scripts/add-expires-at.sql`
6. `scripts/add-payment-ref.sql`
7. `scripts/create-daily-settings.sql`
8. `scripts/seed-admin.sql` � Update with your admin email first

## Edge Functions

Deploy the Sportybet proxy edge function:

```sh
npx supabase functions deploy sportybet-proxy --project-ref <your-project-ref>
```
