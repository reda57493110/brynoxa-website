# Brynoxa

Premium full-stack e-commerce platform for computers, gaming PCs, and tech accessories.

## Stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS + React Query + Framer Motion
- **Backend:** Node.js + Express + MongoDB/Mongoose + JWT + Zod
- **Payments:** Cash on Delivery (COD) only

## Quick start

### Prerequisites

- Node.js 20+
- MongoDB locally **or** leave `MONGODB_URI=memory` in `backend/.env` (auto-seeds on boot)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:5000/api/v1`

Default admin (auto-seeded with memory DB):

- Email: `admin@brynoxa.com`
- Password: `Admin123!`

With a real MongoDB URI, seed once:

```bash
npm run seed
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

### Optional: Docker MongoDB

```bash
docker compose up -d
```

Then set `MONGODB_URI=mongodb://127.0.0.1:27017/brynoxa` in `backend/.env` and run `npm run seed`.

## Features

**Store:** Home, shop filters/search, product detail, cart, COD checkout, wishlist, compare, auth, account orders/tracking/reviews/settings, notifications

**Admin:** Dashboard analytics, products, categories, brands, inventory, orders pipeline, customers, reviews, coupons, settings

## Coupon

Seed includes `BRYNOXA10` (10% off, min $100).
