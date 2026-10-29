# Brynoxa — codebase index

E-commerce store for computers / gaming PCs / accessories. Cash-on-delivery only. Trilingual (en / fr / ar).

## Layout

| Path | What |
|---|---|
| `frontend/` | React 19 + Vite 8 + TS + Tailwind 4, React Query, Zustand, React Router 7, Framer Motion |
| `backend/` | Express 5 + Mongoose 8 + Zod, JWT auth (+ TOTP MFA), Resend email, web-push, Cloudinary/Mongo image storage |
| `api/` | Vercel serverless functions (CommonJS) that wrap the **compiled** backend (`backend/dist`) |
| `vercel.json` | Rewrites that fold many URL paths into a few functions, plus CSP/security headers. Functions run in `cdg1` (Paris), next to the MongoDB Atlas cluster (AWS Paris eu-west-3) — keep them in the same region |

## Commands

- `npm run dev` (root) — runs backend (`tsx watch`, port 5000) and frontend (Vite, 5173) together
- `npm run install:all` — install root + backend + frontend
- Backend: `cd backend && npx tsc --noEmit` (type check), `npm run build` → `backend/dist`
- Frontend: `cd frontend && npx tsc -b --noEmit`, `npm run lint` (oxlint), `npm run build`
- `npm test` (root) — builds the backend, then runs `tests/*.test.cjs` (Node test runner, against `backend/dist` and `api/` with faked database calls) and `tests/*.test.mts` (shop vs server money rules, via tsx). Helpers in `tests/_helpers.cjs`. GitHub Actions runs it on every push (`.github/workflows/tests.yml`). Add a test when fixing a bug or changing a rule.

## Backend (`backend/src`)

- `app.ts` — `getApp()` builds the Express app once; DB connect + `bootstrap.ts` (admin seeding from `ADMIN_EMAIL`/`ADMIN_PASSWORD`) run lazily on first request. `server.ts` is the local entry.
- `routes/` — `auth.routes.ts`, `catalog.routes.ts` (products, categories, brands, images, complete-your-setup), `commerce.routes.ts` (orders, coupons, wishlist, notifications, admin, profit, push, contact, newsletter, settings), `customer.routes.ts` (customers, refunds, wholesale), `inventory.routes.ts` (stock, receipts, returns, repairs), all under `/api/v1`. Reviews were removed (the `Review` model and old data remain).
- `controllers/` → `services/` (business logic) → `models/` (Mongoose). Validation schemas in `validators/schemas.ts`.
- `permissions.ts` — staff role/permission definitions (mirrored in `frontend/src/lib/permissions.ts`).
- Mirrored by hand in `frontend/src/lib/` — keep both copies in sync: `utils/shipping.ts` (free shipping is checked after the coupon), `utils/orderStatus.ts`, `utils/deposit.ts`, `utils/depositSteps.ts`, `utils/orderOrigin.ts` (where an order came from: website, or entered by staff in Admin → Orders → New order).
- Security helpers: `utils/blockedPasswords.ts`, `utils/tokenFreshness.ts` (tokens issued before a password change are refused), `utils/hideCosts.ts` (purchase costs only for owner/catalog), `utils/paymentDetailsAudit.ts`.
- Staff activity (Admin → Roles): every successful staff change is logged in `StaffAction` by the staff checks (`requireStaff` / `requirePermission` and `api/_lib/auth.js`), described by `utils/staffActions.ts` (add a rule there for new admin routes); order work comes from each order's timeline. Built in `services/staffActivity.service.ts`.
- Env: see `backend/.env.example` (`MONGODB_URI`, `CLIENT_URL`, JWT secrets and lifetimes, `MFA_ENCRYPTION_KEY`, Resend, VAPID keys, Cloudinary, admin creds).

## Serverless layer (`api/`)

- `api/index.js` — catch-all: passes the request to the full Express app (`getApp()(req, res)`).
- `api/v1/*.js` — hand-written handlers for hot paths (products, categories, orders, auth, admin, …). They parse `?__route=` / `?__resource=` set by `vercel.json` rewrites and `require('../../backend/dist/...')` services directly.
- `api/_lib/` — shared helpers: `mongo.js` (connection cache), `auth.js` (`requireStaff` etc.), `http.js` (`sendJson`, `sendError` — 5xx never leak details), `rateLimit.js` (MongoDB-backed limits, fail open), `paging.js` (page size ≤ 100), `multipart.js`, and `auth-routes/*` for the split auth function.
- Serverless writes must validate with the same zod schemas as Express (see `validated()` in `api/v1/admin.js` and `auth-routes/me.js`).
- **Gotcha:** changing a backend route may require updating the matching `api/v1/*.js` handler *and* `vercel.json` rewrites — local dev uses Express routes only, production uses these functions first.
- `api/sitemap.js` serves `/sitemap.xml`.

## Frontend (`frontend/src`)

- `app/router.tsx` — lazy routes; layouts in `app/layouts/` (Store, Auth, Admin). Guards in `features/auth/` (`ProtectedRoute`, `AdminRoute`).
- `pages/store/*` — Home, Shop, Category, ProductDetail, Search, Cart, Checkout, Wishlist, Compare, account pages, TrackOrder, Contact, Services, Legal, Help (Help Center at /help), auth pages.
- Help Center content: `lib/help/{en,fr,ar}.ts` (same section/topic ids in all three; describe only what the site really does and link to Terms / service pages instead of copying them). Other pages link to a topic with `<HelpLink topic="…">` (`/help#topic`). `tests/help-guide.test.mts` checks the languages match and every link exists.
- `pages/admin/*` — Dashboard, Analytics, Profit (+ printable `ProfitReport`), Products/ProductForm, CompleteSetupAdmin, Inventory (+ Inventory* sub-pages), Orders/OrderDetail, DeliverySlips, Customers/CustomerProfile, Roles, Messages, Emails, Coupons, PushNotifications, Settings, Security.
- `api/*Api.ts` — axios wrappers on `api/client.ts` (bearer access token + CSRF-protected cookie refresh flow).
- `store/*` — Zustand stores (auth, cart, compare, wishlist, locale, theme, toast, whatsapp).
- `i18n/{en,fr,ar}.ts` + `hooks/useT.ts` — all UI strings; add keys to all three files.
- Language is in the address: English has no prefix (`/shop`), French / Arabic live under `/fr` and `/ar` (router basename from `lib/localePath.ts`, set in `themeInit.ts`; switching language reloads the page). `useSeo` adds canonical + hreflang; `api/sitemap.js` lists all three. Links inside the app need no prefix.
- `components/ui/` — design primitives; `components/product/` — catalog UI; `lib/` — helpers (format, image, analytics, site config, whatsapp).
- `public/sw.js` — service worker for push notifications.
- Env: `VITE_API_URL`, optional `VITE_GA_MEASUREMENT_ID`, `VITE_SITE_URL`.
