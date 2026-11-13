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

# A1-TipsDeck (A1 Predictions) — Developer & Agent Guide

This repository contains the source code for **A1-TipsDeck** (A1 Predictions), a sports prediction and VIP betting advisory platform. It delivers free daily football predictions, premium VIP packages with verified booking codes, subscription passes, manual and automated payments (via Paystack), and an admin management dashboard.

---

## 1. Tech Stack Overview

- **Framework**: [TanStack Start](https://tanstack.com/start) (Full-stack React 19 + Vite 8 + Nitro)
- **Routing**: [TanStack Router](https://tanstack.com/router) with strict file-based routing (`src/routes/`)
- **Data Fetching & Caching**: [TanStack Query](https://tanstack.com/query) v5 (`@tanstack/react-query`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) (`@tailwindcss/vite`, `tw-animate-css`)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) primitives + Lucide React icons (shadcn/ui pattern in `src/components/ui/`)
- **Backend & Database**: [Supabase](https://supabase.com) (PostgreSQL, Supabase Auth, Row Level Security, Storage, Edge Functions)
- **Payments**: [Paystack](https://paystack.com) (Card, Mobile Money, Bank Transfer) + Manual payment receipts
- **Proxy & Edge Services**: Supabase Edge Functions (Deno runtime) for Paystack webhooks, contact email, and Sportybet live odds

---

## 2. Project Directory Structure

```
a1predictions/
├── .github/                  # CI/CD workflows
├── public/                   # Static assets (favicons, robots.txt, etc.)
├── scripts/                  # SQL migrations, seeds, and maintenance scripts
│   ├── supabase_schema.sql   # Core database schema (tables, constraints, seeds)
│   ├── setup-rls.sql         # Row Level Security policies
│   ├── sync-profiles.sql     # Auth to profile sync triggers
│   ├── fix-is-admin.sql      # Admin role elevation and fixes
│   └── seed-admin.sql        # Admin seeding script
├── src/
│   ├── assets/               # Local images, banners, illustrations
│   ├── components/           # Reusable application components
│   │   ├── ui/               # Radix UI primitives (button, dialog, card, etc.)
│   │   ├── auth-shell.tsx    # Auth layout wrapper
│   │   ├── booking-codes-section.tsx # Sportybet booking codes widget
│   │   ├── logo.tsx          # Brand logo component
│   │   ├── page-transition.tsx # Route transition wrapper
│   │   ├── site-header.tsx   # Global navigation bar
│   │   ├── site-footer.tsx   # Global footer
│   │   ├── theme-toggle.tsx  # Light/Dark/System theme switch
│   │   ├── tips-board.tsx    # Free tips listing & filtering
│   │   └── vip-packages-section.tsx # VIP package pricing & purchasing cards
│   ├── hooks/                # Custom React hooks (e.g. use-mobile, useScrollReveal)
│   ├── lib/                  # Utilities, context providers, and client singletons
│   │   ├── auth-context.tsx  # Supabase user & session state provider
│   │   ├── contact-links.ts  # WhatsApp/Telegram/Email support links
│   │   ├── currency.ts       # Currency conversion and formatting utilities
│   │   ├── paystack.ts       # Paystack checkout integration
│   │   ├── store.ts          # Reactive client-side pub/sub store
│   │   ├── supabase.ts       # Supabase client initialization
│   │   ├── theme-provider.tsx# Theme (dark/light/system) provider
│   │   ├── ticket-utils.ts   # VIP pass and user ticket verification
│   │   ├── utils.ts          # Tailwind cn() merge helper
│   │   ├── vip-packages.ts   # VIP package metadata and definitions
│   │   └── vip-status.ts     # User VIP access validation
│   ├── routes/               # TanStack Start file-based routing
│   │   ├── __root.tsx        # Root application layout (providers, head, toaster)
│   │   ├── index.tsx         # Landing page / Home
│   │   ├── predictions.tsx   # Daily free tips directory
│   │   ├── vip.tsx           # VIP packages showcase
│   │   ├── subscriptions.tsx # Subscription plans & passes
│   │   ├── checkout.tsx      # Payment checkout flow
│   │   ├── dashboard.tsx     # User dashboard & purchased tickets
│   │   ├── admin.tsx         # Admin layout and protection guard
│   │   ├── admin/            # Admin subroutes
│   │   │   ├── index.tsx     # Admin dashboard metrics
│   │   │   ├── games.tsx     # Fixture & prediction management
│   │   │   ├── payments.tsx  # Payment review (manual & Paystack)
│   │   │   ├── users.tsx     # User directory & role management
│   │   │   ├── edit-package.tsx # VIP package editor
│   │   │   ├── notifications.tsx # Broadcast notifications
│   │   │   ├── settings.tsx  # Global site configuration
│   │   │   └── sms.tsx       # SMS alert dispatch
│   │   ├── login.tsx         # User authentication
│   │   ├── register.tsx      # User registration
│   │   ├── forgot-password.tsx # Password reset
│   │   ├── welcome.tsx       # Post-registration onboarding
│   │   ├── about.tsx         # About Us page
│   │   ├── contact.tsx       # Contact & support form
│   │   ├── privacy.tsx       # Privacy policy
│   │   ├── refund.tsx        # Refund policy
│   │   └── terms.tsx         # Terms of service
│   ├── routeTree.gen.ts      # Auto-generated route tree (DO NOT EDIT MANUALLY)
│   ├── router.tsx            # TanStack Router instance creation
│   ├── server.ts             # Server entry for SSR error handling
│   ├── start.ts              # TanStack Start entry
│   └── styles.css            # Global CSS & Tailwind imports
├── supabase/
│   └── functions/            # Supabase Edge Functions (Deno)
│       ├── paystack-webhook/ # Webhook verification for automated payments
│       ├── send-contact-email/ # Email forwarding endpoint
│       └── sportybet-proxy/  # Sportybet odds & market data fetcher
├── package.json              # Project dependencies and npm scripts
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite configuration wrapped with Lovable plugin
```

---

## 3. Essential Commands

### Development
```bash
# Start Vite development server (runs with TanStack Start SSR)
npm run dev
```

### Production Build & Preview
```bash
# Build client and server bundles for production
npm run build

# Build using development mode
npm run build:dev

# Preview the production build locally
npm run preview
```

### Code Quality & Formatting
```bash
# Lint code with ESLint
npm run lint

# Format code with Prettier
npm run format
```

### Edge Functions Deployment
```bash
# Deploy a Supabase edge function
npx supabase functions deploy <function-name> --project-ref <supabase-ref>
```

---

## 4. Key Architecture & Coding Conventions

### A. Routing Guidelines (TanStack Start)
- **File-based routing**: All routes reside in `src/routes/`.
- **Root Layout**: `src/routes/__root.tsx` is the application shell containing the providers (`QueryClientProvider`, `AuthProvider`, `ThemeProvider`), global navigation, and `<Outlet />`.
- **Dynamic Segments**: Use `$paramName.tsx` (e.g. `users/$id.tsx`), never `[paramName]`.
- **Splat Segments**: Use `$.tsx` (accessed via `_splat` parameter).
- **Layout Routes**: Prefix with `_` (e.g. `_layout.tsx`) to create layouts without adding URL path segments.
- **Auto-generated Files**: `src/routeTree.gen.ts` is managed automatically by the TanStack Router Vite plugin. **Never edit it by hand.**
- **No Next.js / Remix Patterns**: Do **not** create `src/pages/`, `app/`, or nested `layout.tsx` files.

### B. Vite & Build Configuration
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`.
- **Do not manually add plugins** that are already pre-packaged in the config (e.g., TanStack DevTools, Vite React, Tailwind, tsConfigPaths, Nitro). Adding them creates duplicates that break the build.
- Sportybet development proxy is configured in `vite.config.ts` under `/api/sportybet`.

### C. State Management & Data Fetching
- **Server Data**: Fetch and mutate via `@tanstack/react-query` hooks (`useQuery`, `useMutation`).
- **Auth State**: Access the active user and session via `useAuth()` from `@/lib/auth-context`.
- **Local / Ephemeral State**: Use `src/lib/store.ts` for synchronized client-only store or standard React hooks (`useState`, `useReducer`).
- **Theme**: Use `useTheme()` from `@/lib/theme-provider` (`light`, `dark`, or `system`).

### D. Supabase, Security & Permissions
- Client initialization is in `src/lib/supabase.ts`.
- **Never expose the Supabase `SERVICE_ROLE_KEY`** in any client-side code (`src/`). Only `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` should be used in the frontend.
- Privileged operations (webhook processing, admin elevation) belong in Supabase Edge Functions or admin scripts.
- Admin routes (`src/routes/admin.tsx` and child routes) perform client checks against `profiles.is_admin` backed by database RLS.

### E. VIP Packages & Booking Codes
- Fixed VIP tiers: `vip_1`, `vip_2`, `vvip_1`, `vvip_2`, `supreme_vvip`.
- Tickets are stored in the `user_tickets` table, supporting both individual package purchases and subscription passes (`sub_*`).
- User ticket verification logic is centralized in `src/lib/ticket-utils.ts` and `src/lib/vip-status.ts`.

---

## 5. Environment Variables

Create a `.env` file in the root directory for local development:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 6. Rules for AI Agents

1. **Preserve Lovable Integration**: Never rewrite published git history (`git push --force`, rebase, amend published commits).
2. **Preserve Route Integrity**: Always follow TanStack Router conventions. Verify that any new route matches the file-naming scheme and renders `<Outlet />` if acting as a layout.
3. **Keep Imports Consistent**: Use the `@/` path alias for `src/` (e.g., `@/components/ui/button`, `@/lib/supabase`).
4. **CSS & Styling**: Follow Tailwind CSS v4 conventions. Rely on design tokens defined in `src/styles.css` and `src/dashboard-theme.css`.
5. **No Regressions in Auth/Admin**: Test that public routes remain accessible while `/dashboard` and `/admin` routes maintain proper authentication and authorization checks.
