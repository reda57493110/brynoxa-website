import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { StoreLayout } from '@/app/layouts/StoreLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { AdminRoute } from '@/features/auth/AdminRoute'
import { PageLoader } from '@/components/ui/PageLoader'

// The landing page ships with the app: no extra download (and no loader) for most first visits
import { Home } from '@/pages/store/Home'

// Admin only: kept out of the shoppers' bundle
const AdminLayout = lazy(() => import('@/app/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const Shop = lazy(() => import('@/pages/store/Shop').then((m) => ({ default: m.Shop })))
const NotFound = lazy(() => import('@/pages/store/NotFound').then((m) => ({ default: m.NotFound })))
const CategoryPage = lazy(() =>
  import('@/pages/store/CategoryPage').then((m) => ({ default: m.CategoryPage }))
)
const ProductDetail = lazy(() =>
  import('@/pages/store/ProductDetail').then((m) => ({ default: m.ProductDetail }))
)
const Search = lazy(() => import('@/pages/store/Search').then((m) => ({ default: m.Search })))
const Cart = lazy(() => import('@/pages/store/Cart').then((m) => ({ default: m.Cart })))
const Checkout = lazy(() => import('@/pages/store/Checkout').then((m) => ({ default: m.Checkout })))
const Compare = lazy(() => import('@/pages/store/Compare').then((m) => ({ default: m.Compare })))
const Notifications = lazy(() =>
  import('@/pages/store/Notifications').then((m) => ({ default: m.Notifications }))
)
const Login = lazy(() => import('@/pages/store/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() =>
  import('@/pages/store/Register').then((m) => ({ default: m.Register }))
)
const ForgotPassword = lazy(() =>
  import('@/pages/store/ForgotPassword').then((m) => ({ default: m.ForgotPassword }))
)
const VerifyEmail = lazy(() =>
  import('@/pages/store/VerifyEmail').then((m) => ({ default: m.VerifyEmail }))
)
const ResetPassword = lazy(() =>
  import('@/pages/store/ResetPassword').then((m) => ({ default: m.ResetPassword }))
)
const Account = lazy(() => import('@/pages/store/Account').then((m) => ({ default: m.Account })))
const Orders = lazy(() => import('@/pages/store/Orders').then((m) => ({ default: m.Orders })))
const OrderDetail = lazy(() =>
  import('@/pages/store/OrderDetail').then((m) => ({ default: m.OrderDetail }))
)
const AccountSettings = lazy(() =>
  import('@/pages/store/AccountSettings').then((m) => ({ default: m.AccountSettings }))
)
const TrackOrder = lazy(() =>
  import('@/pages/store/TrackOrder').then((m) => ({ default: m.TrackOrder }))
)
const OrderConfirmation = lazy(() =>
  import('@/pages/store/OrderConfirmation').then((m) => ({ default: m.OrderConfirmation }))
)
const Contact = lazy(() => import('@/pages/store/Contact').then((m) => ({ default: m.Contact })))
const Services = lazy(() => import('@/pages/store/Services').then((m) => ({ default: m.Services })))
const ServiceDetail = lazy(() =>
  import('@/pages/store/ServiceDetail').then((m) => ({ default: m.ServiceDetail }))
)
const Help = lazy(() => import('@/pages/store/Help').then((m) => ({ default: m.Help })))
const Legal = lazy(() => import('@/pages/store/Legal').then((m) => ({ default: m.Legal })))

const AdminCustomersPrint = lazy(() =>
  import('@/pages/admin/CustomersPrint').then((m) => ({ default: m.CustomersPrint }))
)
const AdminDeliverySlips = lazy(() =>
  import('@/pages/admin/DeliverySlips').then((m) => ({ default: m.DeliverySlips }))
)
const AdminAnalytics = lazy(() =>
  import('@/pages/admin/Analytics').then((m) => ({ default: m.Analytics }))
)
const AdminProfitReport = lazy(() =>
  import('@/pages/admin/ProfitReport').then((m) => ({ default: m.ProfitReport }))
)
const AdminProfit = lazy(() =>
  import('@/pages/admin/Profit').then((m) => ({ default: m.Profit }))
)
const AdminDashboard = lazy(() =>
  import('@/pages/admin/Dashboard').then((m) => ({ default: m.Dashboard }))
)
const AdminProducts = lazy(() =>
  import('@/pages/admin/Products').then((m) => ({ default: m.Products }))
)
const AdminProductForm = lazy(() =>
  import('@/pages/admin/ProductForm').then((m) => ({ default: m.ProductForm }))
)
const AdminCompleteSetup = lazy(() =>
  import('@/pages/admin/CompleteSetupAdmin').then((m) => ({ default: m.CompleteSetupAdmin }))
)
const AdminInventory = lazy(() =>
  import('@/pages/admin/Inventory').then((m) => ({ default: m.Inventory }))
)
const AdminInventoryProduct = lazy(() =>
  import('@/pages/admin/InventoryProduct').then((m) => ({ default: m.InventoryProduct }))
)
const AdminInventoryReceive = lazy(() =>
  import('@/pages/admin/InventoryReceive').then((m) => ({ default: m.InventoryReceive }))
)
const AdminInventoryReturns = lazy(() =>
  import('@/pages/admin/InventoryReturns').then((m) => ({ default: m.InventoryReturns }))
)
const AdminInventoryReturn = lazy(() =>
  import('@/pages/admin/InventoryReturn').then((m) => ({ default: m.InventoryReturn }))
)
const AdminInventoryRepairs = lazy(() =>
  import('@/pages/admin/InventoryRepairs').then((m) => ({ default: m.InventoryRepairs }))
)
const AdminInventoryRepair = lazy(() =>
  import('@/pages/admin/InventoryRepair').then((m) => ({ default: m.InventoryRepair }))
)
const AdminInventoryMovements = lazy(() =>
  import('@/pages/admin/InventoryMovements').then((m) => ({ default: m.InventoryMovements }))
)
const AdminOrders = lazy(() =>
  import('@/pages/admin/Orders').then((m) => ({ default: m.Orders }))
)
const AdminNewOrder = lazy(() =>
  import('@/pages/admin/NewOrder').then((m) => ({ default: m.NewOrder }))
)
const AdminOrderDetail = lazy(() =>
  import('@/pages/admin/OrderDetail').then((m) => ({ default: m.OrderDetail }))
)
const AdminCustomers = lazy(() =>
  import('@/pages/admin/Customers').then((m) => ({ default: m.Customers }))
)
const AdminCustomerProfile = lazy(() =>
  import('@/pages/admin/CustomerProfile').then((m) => ({ default: m.CustomerProfile }))
)
const AdminRoles = lazy(() => import('@/pages/admin/Roles').then((m) => ({ default: m.Roles })))
const AdminStaffActivity = lazy(() => import('@/pages/admin/StaffActivity').then((m) => ({ default: m.StaffActivity })))
const AdminEmails = lazy(() => import('@/pages/admin/Emails').then((m) => ({ default: m.Emails })))
const AdminMessages = lazy(() =>
  import('@/pages/admin/Messages').then((m) => ({ default: m.Messages }))
)
const AdminCoupons = lazy(() =>
  import('@/pages/admin/Coupons').then((m) => ({ default: m.Coupons }))
)
const AdminPushNotifications = lazy(() =>
  import('@/pages/admin/PushNotifications').then((m) => ({ default: m.PushNotifications }))
)
const AdminSettings = lazy(() =>
  import('@/pages/admin/Settings').then((m) => ({ default: m.Settings }))
)
const AdminSecurity = lazy(() =>
  import('@/pages/admin/Security').then((m) => ({ default: m.Security }))
)

/** Shown only if a page takes a moment to download — fast loads never flash a spinner. */
function DelayedLoader() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 350)
    return () => window.clearTimeout(id)
  }, [])
  return show ? <PageLoader /> : <div className="min-h-[60vh]" aria-hidden="true" />
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DelayedLoader />}>{children}</Suspense>
}

// After the first page is shown, fetch the pages shoppers open next so they appear instantly —
// a few seconds after load, so on a phone they don't compete with this page's data and photos
if (typeof window !== 'undefined') {
  const preload = () => {
    void import('@/pages/store/Shop')
    void import('@/pages/store/ProductDetail')
    void import('@/pages/store/CategoryPage')
  }
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
  window.addEventListener('load', () => window.setTimeout(() => (idle ? idle(preload) : preload()), 4000), { once: true })
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
        <Route path="checkout" element={<S><Checkout /></S>} />
        <Route path="compare" element={<S><Compare /></S>} />
        <Route
          path="account/notifications"
          element={
            <ProtectedRoute>
              <S><Notifications /></S>
            </ProtectedRoute>
          }
        />
        <Route path="contact" element={<S><Contact /></S>} />
        <Route path="services" element={<S><Services /></S>} />
        <Route path="services/:slug" element={<S><ServiceDetail /></S>} />
        <Route path="help" element={<S><Help /></S>} />
        <Route path="privacy" element={<S><Legal page="privacy" /></S>} />
        <Route path="terms" element={<S><Legal page="terms" /></S>} />
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
        <Route path="account/reviews" element={<Navigate to="/account" replace />} />
        <Route
          path="account/settings"
          element={
            <ProtectedRoute>
              <S><AccountSettings /></S>
            </ProtectedRoute>
          }
        />
        <Route path="track-order" element={<S><TrackOrder /></S>} />
        <Route path="order-confirmation/:orderNumber" element={<S><OrderConfirmation /></S>} />
        <Route path="*" element={<S><NotFound /></S>} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="login" element={<S><Login /></S>} />
        <Route path="register" element={<S><Register /></S>} />
        <Route path="forgot-password" element={<S><ForgotPassword /></S>} />
        <Route path="verify-email" element={<S><VerifyEmail /></S>} />
        <Route path="reset-password" element={<S><ResetPassword /></S>} />
      </Route>

      {/* Print view without the admin chrome */}
      <Route
        path="admin-print/profit"
        element={
          <AdminRoute>
            <S>
              <AdminProfitReport />
            </S>
          </AdminRoute>
        }
      />
      <Route
        path="admin-print/customers"
        element={
          <AdminRoute>
            <S>
              <AdminCustomersPrint />
            </S>
          </AdminRoute>
        }
      />
      <Route
        path="admin-print/slips"
        element={
          <AdminRoute>
            <S>
              <AdminDeliverySlips />
            </S>
          </AdminRoute>
        }
      />

      <Route
        path="admin"
        element={
          <AdminRoute>
            <Suspense fallback={<DelayedLoader />}>
              <AdminLayout />
            </Suspense>
          </AdminRoute>
        }
      >
        <Route index element={<S><AdminDashboard /></S>} />
        <Route path="analytics" element={<S><AdminAnalytics /></S>} />
        <Route path="profit" element={<S><AdminProfit /></S>} />
        <Route path="products" element={<S><AdminProducts /></S>} />
        <Route path="products/new" element={<S><AdminProductForm /></S>} />
        <Route path="products/:id/edit" element={<S><AdminProductForm /></S>} />
        <Route path="setup" element={<S><AdminCompleteSetup /></S>} />
        <Route path="inventory" element={<S><AdminInventory /></S>} />
        <Route path="inventory/products/:id" element={<S><AdminInventoryProduct /></S>} />
        <Route path="inventory/receive" element={<S><AdminInventoryReceive /></S>} />
        <Route path="inventory/returns" element={<S><AdminInventoryReturns /></S>} />
        <Route path="inventory/returns/:id" element={<S><AdminInventoryReturn /></S>} />
        <Route path="inventory/repairs" element={<S><AdminInventoryRepairs /></S>} />
        <Route path="inventory/repairs/:id" element={<S><AdminInventoryRepair /></S>} />
        <Route path="inventory/movements" element={<S><AdminInventoryMovements /></S>} />
        <Route path="orders" element={<S><AdminOrders /></S>} />
        <Route path="orders/new" element={<S><AdminNewOrder /></S>} />
        <Route path="orders/:id" element={<S><AdminOrderDetail /></S>} />
        <Route path="customers" element={<S><AdminCustomers /></S>} />
        <Route path="customers/:id" element={<S><AdminCustomerProfile /></S>} />
        <Route path="roles" element={<S><AdminRoles /></S>} />
        <Route path="roles/:id" element={<S><AdminStaffActivity /></S>} />
        <Route path="messages" element={<S><AdminMessages /></S>} />
        <Route path="emails" element={<S><AdminEmails /></S>} />
        <Route path="reviews" element={<Navigate to="/admin" replace />} />
        <Route path="coupons" element={<S><AdminCoupons /></S>} />
        <Route path="notifications" element={<S><AdminPushNotifications /></S>} />
        <Route path="security" element={<S><AdminSecurity /></S>} />
        <Route path="settings" element={<S><AdminSettings /></S>} />
      </Route>

    </Routes>
  )
}
