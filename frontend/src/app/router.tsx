import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { StoreLayout } from '@/app/layouts/StoreLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { AdminLayout } from '@/app/layouts/AdminLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { AdminRoute } from '@/features/auth/AdminRoute'
import { PageSkeleton } from '@/components/ui/Skeleton'

const Home = lazy(() => import('@/pages/store/Home').then((m) => ({ default: m.Home })))
const Shop = lazy(() => import('@/pages/store/Shop').then((m) => ({ default: m.Shop })))
const CategoryPage = lazy(() =>
  import('@/pages/store/CategoryPage').then((m) => ({ default: m.CategoryPage }))
)
const ProductDetail = lazy(() =>
  import('@/pages/store/ProductDetail').then((m) => ({ default: m.ProductDetail }))
)
const Search = lazy(() => import('@/pages/store/Search').then((m) => ({ default: m.Search })))
const Cart = lazy(() => import('@/pages/store/Cart').then((m) => ({ default: m.Cart })))
const Checkout = lazy(() => import('@/pages/store/Checkout').then((m) => ({ default: m.Checkout })))
const Wishlist = lazy(() =>
  import('@/pages/store/Wishlist').then((m) => ({ default: m.Wishlist }))
)
const Login = lazy(() => import('@/pages/store/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() =>
  import('@/pages/store/Register').then((m) => ({ default: m.Register }))
)
const Account = lazy(() => import('@/pages/store/Account').then((m) => ({ default: m.Account })))
const Orders = lazy(() => import('@/pages/store/Orders').then((m) => ({ default: m.Orders })))
const OrderDetail = lazy(() =>
  import('@/pages/store/OrderDetail').then((m) => ({ default: m.OrderDetail }))
)
const AccountReviews = lazy(() =>
  import('@/pages/store/AccountReviews').then((m) => ({ default: m.AccountReviews }))
)
const AccountSettings = lazy(() =>
  import('@/pages/store/AccountSettings').then((m) => ({ default: m.AccountSettings }))
)
const OrderConfirmation = lazy(() =>
  import('@/pages/store/OrderConfirmation').then((m) => ({ default: m.OrderConfirmation }))
)
const Contact = lazy(() => import('@/pages/store/Contact').then((m) => ({ default: m.Contact })))
const Services = lazy(() => import('@/pages/store/Services').then((m) => ({ default: m.Services })))

const AdminDashboard = lazy(() =>
  import('@/pages/admin/Dashboard').then((m) => ({ default: m.Dashboard }))
)
const AdminProducts = lazy(() =>
  import('@/pages/admin/Products').then((m) => ({ default: m.Products }))
)
const AdminProductForm = lazy(() =>
  import('@/pages/admin/ProductForm').then((m) => ({ default: m.ProductForm }))
)
const AdminCategories = lazy(() =>
  import('@/pages/admin/Categories').then((m) => ({ default: m.Categories }))
)
const AdminBrands = lazy(() =>
  import('@/pages/admin/Brands').then((m) => ({ default: m.Brands }))
)
const AdminInventory = lazy(() =>
  import('@/pages/admin/Inventory').then((m) => ({ default: m.Inventory }))
)
const AdminOrders = lazy(() =>
  import('@/pages/admin/Orders').then((m) => ({ default: m.Orders }))
)
const AdminOrderDetail = lazy(() =>
  import('@/pages/admin/OrderDetail').then((m) => ({ default: m.OrderDetail }))
)
const AdminCustomers = lazy(() =>
  import('@/pages/admin/Customers').then((m) => ({ default: m.Customers }))
)
const AdminReviews = lazy(() =>
  import('@/pages/admin/Reviews').then((m) => ({ default: m.Reviews }))
)
const AdminCoupons = lazy(() =>
  import('@/pages/admin/Coupons').then((m) => ({ default: m.Coupons }))
)
const AdminSettings = lazy(() =>
  import('@/pages/admin/Settings').then((m) => ({ default: m.Settings }))
)

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<S><Home /></S>} />
        <Route path="shop" element={<S><Shop /></S>} />
        <Route path="category/:slug" element={<S><CategoryPage /></S>} />
        <Route path="product/:slug" element={<S><ProductDetail /></S>} />
        <Route path="search" element={<S><Search /></S>} />
        <Route path="cart" element={<S><Cart /></S>} />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <S><Checkout /></S>
            </ProtectedRoute>
          }
        />
        <Route path="wishlist" element={<S><Wishlist /></S>} />
        <Route path="contact" element={<S><Contact /></S>} />
        <Route path="services" element={<S><Services /></S>} />
        <Route
          path="account"
          element={
            <ProtectedRoute>
              <S><Account /></S>
            </ProtectedRoute>
          }
        />
        <Route
          path="account/orders"
          element={
            <ProtectedRoute>
              <S><Orders /></S>
            </ProtectedRoute>
          }
        />
        <Route
          path="account/orders/:orderNumber"
          element={
            <ProtectedRoute>
              <S><OrderDetail /></S>
            </ProtectedRoute>
          }
        />
        <Route
          path="account/reviews"
          element={
            <ProtectedRoute>
              <S><AccountReviews /></S>
            </ProtectedRoute>
          }
        />
        <Route
          path="account/settings"
          element={
            <ProtectedRoute>
              <S><AccountSettings /></S>
            </ProtectedRoute>
          }
        />
        <Route
          path="order-confirmation/:orderNumber"
          element={
            <ProtectedRoute>
              <S><OrderConfirmation /></S>
            </ProtectedRoute>
          }
        />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="login" element={<S><Login /></S>} />
        <Route path="register" element={<S><Register /></S>} />
      </Route>

      <Route
        path="admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<S><AdminDashboard /></S>} />
        <Route path="products" element={<S><AdminProducts /></S>} />
        <Route path="products/new" element={<S><AdminProductForm /></S>} />
        <Route path="products/:id/edit" element={<S><AdminProductForm /></S>} />
        <Route path="categories" element={<S><AdminCategories /></S>} />
        <Route path="brands" element={<S><AdminBrands /></S>} />
        <Route path="inventory" element={<S><AdminInventory /></S>} />
        <Route path="orders" element={<S><AdminOrders /></S>} />
        <Route path="orders/:id" element={<S><AdminOrderDetail /></S>} />
        <Route path="customers" element={<S><AdminCustomers /></S>} />
        <Route path="reviews" element={<S><AdminReviews /></S>} />
        <Route path="coupons" element={<S><AdminCoupons /></S>} />
        <Route path="settings" element={<S><AdminSettings /></S>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
