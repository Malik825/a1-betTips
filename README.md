# A1-TipsDeck

A sports predictions and premium subscription platform built to provide users with access to daily football predictions, premium packages, and booking-code information.

Built with **TanStack Start, React, TypeScript, Supabase, Tailwind CSS, and Paystack**, the application combines user authentication, content management, payment processing, and third-party sports odds integration.

## Overview

A1-TipsDeck is a web application designed around two experiences: users accessing free and premium prediction content, and administrators managing the platform's predictions, fixtures, packages, and settings.

The platform integrates Supabase for authentication and data management, Paystack for payment processing, and Supabase Edge Functions to proxy SportyBet odds requests.

## Key Features

### Prediction Management
- Access daily football predictions.
- Explore predictions across multiple football leagues.
- Browse free and premium prediction packages.

### Premium Packages
- Premium packages with associated booking-code information.
- Subscription and payment workflows for premium access.

### Authentication
- User registration and login.
- Supabase-powered authentication.
- User profile management.

### Admin Console
- Manage fixtures and predictions.
- Manage premium packages.
- Configure application settings.
- Administrative controls for platform management.

### Payment Integration
- Paystack payment integration.
- Payment reference handling.
- Support for premium content access workflows.

### SportyBet Odds Integration
- Retrieves SportyBet odds through a Supabase Edge Function proxy.
- Keeps third-party API requests behind a server-side integration layer.

### Responsive Interface
- Mobile-friendly application layout.
- Dark and light theme support.

## Technology Stack

| Area | Technologies |
|---|---|
| Framework | TanStack Start |
| UI | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase |
| Authentication | Supabase Auth |
| Serverless Functions | Supabase Edge Functions (Deno) |
| Payments | Paystack |
| External Integration | SportyBet odds API |

## Architecture

The application uses a modern web architecture:

- **Frontend:** TanStack Start and React provide the application interface and routing.
- **Backend services:** Supabase provides authentication, database functionality, and serverless Edge Functions.
- **Payments:** Paystack handles payment integration.
- **External API proxy:** A Supabase Edge Function acts as a proxy for SportyBet odds requests.

## Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project

### Installation

Clone the repository:

```bash
git clone https://github.com/Malik825/A1-TipsDeck.git
cd A1-TipsDeck
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

Use your own project credentials. Never commit private keys, service-role keys, or other secrets.

## Database Setup

Run the SQL scripts in the appropriate order using the Supabase SQL Editor:

1. `supabase_schema.sql` — Core database tables.
2. `scripts/sync-profiles.sql`
3. `scripts/setup-rls.sql`
4. `scripts/fix-is-admin.sql`
5. `scripts/add-expires-at.sql`
6. `scripts/add-payment-ref.sql`
7. `scripts/create-daily-settings.sql`
8. `scripts/seed-admin.sql` — Configure the administrator email before running.

## Supabase Edge Functions

Deploy the SportyBet proxy function:

```bash
npx supabase functions deploy sportybet-proxy --project-ref <your-project-ref>
```

Configure the required Edge Function secrets and project settings before deployment.

## Engineering Highlights

This project demonstrates practical experience with:

- Modern React application development using TanStack Start.
- Supabase authentication and database integration.
- Payment gateway integration with Paystack.
- Serverless backend functionality using Supabase Edge Functions.
- Row Level Security and database access controls.
- Third-party API integration through a server-side proxy.
- Administrative dashboards and content management workflows.
- Responsive application development.

## License

See the repository for licensing and usage information.
