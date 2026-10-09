# Brynoxa — codebase index

E-commerce store for computers / gaming PCs / accessories. Cash-on-delivery only. Trilingual (en / fr / ar).

## Layout

| Path | What |
|---|---|
| `frontend/` | React 19 + Vite 8 + TS + Tailwind 4, React Query, Zustand, React Router 7, Framer Motion |
| `backend/` | Express 5 + Mongoose 8 + Zod, JWT auth (+ TOTP MFA), Resend email, web-push, Cloudinary/Mongo image storage |
| `api/` | Vercel serverless functions (CommonJS) that wrap the **compiled** backend (`backend/dist`) |
| `vercel.json` | Rewrites that fold many URL paths into a few functions, plus CSP/security headers |

## Commands

- `npm run dev` (root) — runs backend (`tsx watch`, port 5000) and frontend (Vite, 5173) together
- `npm run install:all` — install root + backend + frontend
- Backend: `cd backend && npx tsc --noEmit` (type check), `npm run build` → `backend/dist`
- Frontend: `cd frontend && npx tsc -b --noEmit`, `npm run lint` (oxlint), `npm run build`
- No test suite exists.

## Backend (`backend/src`)

- `app.ts` — `getApp()` builds the Express app once; DB connect + `bootstrap.ts` (admin seeding from `ADMIN_EMAIL`/`ADMIN_PASSWORD`) run lazily on first request. `server.ts` is the local entry.
- `routes/` — `auth.routes.ts`, `catalog.routes.ts` (products, categories, brands, images), `commerce.routes.ts` (orders, coupons, reviews, wishlist, notifications, admin, push, contact, newsletter, settings), all under `/api/v1`.
- `controllers/` → `services/` (business logic) → `models/` (Mongoose). Validation schemas in `validators/schemas.ts`.
- `permissions.ts` — staff role/permission definitions (mirrored in `frontend/src/lib/permissions.ts`).
- `utils/shipping.ts` — shipping rules (mirrored in `frontend/src/lib/shipping.ts`). Keep both copies in sync.
- Env: see `backend/.env.example` (`MONGODB_URI`, `CLIENT_URL`, JWT secrets, `MFA_ENCRYPTION_KEY`, Resend, VAPID keys, admin creds).

## Serverless layer (`api/`)

- `api/index.js` — catch-all: wraps the full Express app with `serverless-http`.
- `api/v1/*.js` — hand-written handlers for hot paths (products, categories, orders, auth, admin, …). They parse `?__route=` / `?__resource=` set by `vercel.json` rewrites and `require('../../backend/dist/...')` services directly.
- `api/_lib/` — shared helpers: `mongo.js` (connection cache), `auth.js` (`requireStaff` etc.), `http.js`, `multipart.js`, and `auth-routes/*` for the split auth function.
- **Gotcha:** changing a backend route may require updating the matching `api/v1/*.js` handler *and* `vercel.json` rewrites — local dev uses Express routes only, production uses these functions first.
- `api/sitemap.js` serves `/sitemap.xml`.

## Frontend (`frontend/src`)

- `app/router.tsx` — lazy routes; layouts in `app/layouts/` (Store, Auth, Admin). Guards in `features/auth/` (`ProtectedRoute`, `AdminRoute`).
- `pages/store/*` — Home, Shop, Category, ProductDetail, Search, Cart, Checkout, Wishlist, Compare, account pages, TrackOrder, Contact, Services, Legal, auth pages.
- `pages/admin/*` — Dashboard, Products/ProductForm, Inventory, Orders/OrderDetail, Customers, Roles, Messages, Reviews, Coupons, PushNotifications, Settings, Security.
- `api/*Api.ts` — axios wrappers on `api/client.ts` (bearer access token + CSRF-protected cookie refresh flow).
- `store/*` — Zustand stores (auth, cart, compare, wishlist, locale, theme, toast, whatsapp).
- `i18n/{en,fr,ar}.ts` + `hooks/useT.ts` — all UI strings; add keys to all three files.
- `components/ui/` — design primitives; `components/product/` — catalog UI; `lib/` — helpers (format, image, analytics, site config, whatsapp).
- `public/sw.js` — service worker for push notifications.
- Env: `VITE_API_URL`, optional `VITE_GA_MEASUREMENT_ID`.
