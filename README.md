# Brynoxa

Premium full-stack e-commerce platform for computers, gaming PCs, and tech accessories.

## Stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS + React Query + Framer Motion
- **Backend:** Node.js + Express + MongoDB/Mongoose + JWT + Zod
- **Payments:** Cash on Delivery (COD) only

## Quick start

### Prerequisites

- Node.js 20+
- A MongoDB connection string in `backend/.env` (`MONGODB_URI`)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:5000/api/v1`

The admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

## Features

**Store:** Home, shop filters/search, product detail, cart, COD checkout, wishlist, compare, auth, account orders/tracking/reviews/settings, notifications

**Admin:** Dashboard analytics, products, categories, brands, inventory, orders pipeline, customers, reviews, coupons, settings
