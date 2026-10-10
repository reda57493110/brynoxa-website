import api from './client'
import type {
  ApiResponse,
  AssessReturnPayload,
  CustomerReturn,
  InventoryBucket,
  InventoryQueryParams,
  InventoryRow,
  InventorySummary,
  Product,
  ProductInventoryDetail,
  ReceiptPayload,
  RepairDetail,
  RepairRecord,
  RepairStatus,
  ReturnPayload,
  StockMovement,
  SupplierReceipt,
} from '@/types'

function clean<T extends object>(params?: T) {
  if (!params) return undefined
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

/**
 * Admin inventory. Approving repaired units, write-offs and stock adjustments need the
 * 'inventory:approve' permission — the server answers 403 otherwise (show its message).
 */
export const inventoryApi = {
  list: (params?: InventoryQueryParams) =>
    api.get<ApiResponse<InventoryRow[]>>('/admin/inventory', { params: clean(params) }),
  summary: () => api.get<ApiResponse<InventorySummary>>('/admin/inventory/summary'),
  product: (id: string) => api.get<ApiResponse<ProductInventoryDetail>>(`/admin/inventory/products/${id}`),
  /** Creates (or returns the existing) hidden Refurbished / Used listing of this model. */
  createListing: (id: string, payload: { condition: 'refurbished' | 'used'; price?: number }) =>
    api.post<ApiResponse<Product>>(`/admin/inventory/products/${id}/listing`, payload),
  /** Change units' status (inspection results, defective, to repair, write-off…). */
  move: (payload: {
    productId: string
    from: InventoryBucket
    to: InventoryBucket
    qty: number
    serials?: string[]
    reason: string
    fault?: string
  }) => api.post<ApiResponse<ProductInventoryDetail>>('/admin/inventory/move', payload),
  /** Stock-take correction: +/- units in one status (reason required, approval rights). */
  adjust: (payload: { productId: string; bucket: InventoryBucket; delta: number; reason: string; unitCost?: number }) =>
    api.post<ApiResponse<ProductInventoryDetail>>('/admin/inventory/adjust', payload),
  registerSerials: (payload: { productId: string; bucket: InventoryBucket; serials: string[]; location?: string }) =>
    api.post<ApiResponse<{ registered: number }>>('/admin/inventory/serials', payload),

  receipts: (params?: { page?: number; limit?: number; supplier?: string }) =>
    api.get<ApiResponse<SupplierReceipt[]>>('/admin/inventory/receipts', { params: clean(params) }),
  receive: (payload: ReceiptPayload) => api.post<ApiResponse<SupplierReceipt>>('/admin/inventory/receipts', payload),

  returns: (params?: { page?: number; limit?: number; status?: CustomerReturn['status'] | '' }) =>
    api.get<ApiResponse<CustomerReturn[]>>('/admin/inventory/returns', { params: clean(params) }),
  returnDetail: (id: string) => api.get<ApiResponse<CustomerReturn>>(`/admin/inventory/returns/${id}`),
  /** Register units sent back for a shipped / delivered order. */
  createReturn: (orderId: string, payload: ReturnPayload) =>
    api.post<ApiResponse<CustomerReturn>>(`/admin/orders/${orderId}/returns`, payload),
  assessReturn: (id: string, payload: AssessReturnPayload) =>
    api.post<ApiResponse<CustomerReturn>>(`/admin/inventory/returns/${id}/assess`, payload),

  repairs: (params?: { page?: number; limit?: number; status?: RepairStatus | ''; open?: 'true' | 'false' | '' }) =>
    api.get<ApiResponse<RepairRecord[]>>('/admin/inventory/repairs', { params: clean(params) }),
  repair: (id: string) => api.get<ApiResponse<RepairDetail>>(`/admin/inventory/repairs/${id}`),
  updateRepair: (
    id: string,
    payload: { status?: Exclude<RepairStatus, 'qc-passed' | 'qc-failed'>; diagnosis?: string; cost?: number; technician?: string; partsReplaced?: string[]; note?: string }
  ) => api.patch<ApiResponse<RepairDetail>>(`/admin/inventory/repairs/${id}`, payload),
  /** Quality check: passed units need a target listing for refurbished / used. */
  completeRepair: (
    id: string,
    payload: { qcResult: 'passed' | 'failed'; finalStatus: 'new' | 'refurbished' | 'used' | 'defective' | 'write-off'; targetProductId?: string; qcNote?: string }
  ) => api.post<ApiResponse<RepairDetail>>(`/admin/inventory/repairs/${id}/complete`, payload),

  movements: (params?: { page?: number; limit?: number; product?: string; type?: string; from?: string; to?: string }) =>
    api.get<ApiResponse<StockMovement[]>>('/admin/inventory/movements', { params: clean(params) }),
}
