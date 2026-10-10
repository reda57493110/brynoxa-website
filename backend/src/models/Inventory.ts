import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Inventory data model.
 *
 * Every product (listing) keeps its SELLABLE units in `Product.stock` (what checkout uses) and
 * its non-sellable units in `Product.inventory` buckets. Every change to either is written to
 * the StockMovement ledger in the same database transaction.
 */

/** Where a unit can be. "external" = outside the store (supplier side, or sold / dispatched). */
export const BUCKETS = [
  'available',
  'reserved',
  'awaitingInspection',
  'returned',
  'defective',
  'underRepair',
  'writtenOff',
] as const;
export type BaseBucket = (typeof BUCKETS)[number];
/** Custom holding statuses defined in Settings are stored as `custom:<id>`. */
export type Bucket = BaseBucket | `custom:${string}` | 'external';

export const MOVEMENT_TYPES = [
  'supplier-receipt',
  'customer-return',
  'order-reservation',
  'order-dispatch',
  'reservation-release',
  'condition-change',
  'repair-transfer',
  'repair-completion',
  'listing-transfer',
  'stock-adjustment',
  'write-off',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/* ---------------- Ledger ---------------- */

export interface IStockMovement extends Document {
  product: Types.ObjectId;
  sku: string;
  type: MovementType;
  qty: number;
  from: Bucket;
  to: Bucket;
  /** Bucket counts after the move (before = after ∓ qty). */
  fromAfter?: number;
  toAfter?: number;
  serials: string[];
  unitCost?: number;
  reason: string;
  order?: Types.ObjectId;
  orderNumber?: string;
  receipt?: Types.ObjectId;
  customerReturn?: Types.ObjectId;
  repair?: Types.ObjectId;
  /** Links the two halves of a move between listings (e.g. repaired unit → refurbished listing). */
  transferId?: string;
  by?: Types.ObjectId;
  /** Unique when set: replays of the same event are rejected instead of applied twice. */
  idempotencyKey?: string;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    qty: { type: Number, required: true, min: 1 },
    from: { type: String, required: true },
    to: { type: String, required: true },
    fromAfter: Number,
    toAfter: Number,
    serials: { type: [String], default: [] },
    unitCost: Number,
    reason: { type: String, required: true, maxlength: 500 },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,
    receipt: { type: Schema.Types.ObjectId, ref: 'SupplierReceipt' },
    customerReturn: { type: Schema.Types.ObjectId, ref: 'CustomerReturn' },
    repair: { type: Schema.Types.ObjectId, ref: 'RepairRecord' },
    transferId: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    idempotencyKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', stockMovementSchema);

/* ---------------- Serial-tracked units ---------------- */

export type UnitStatus = Exclude<Bucket, 'external'> | 'sold';

export interface IInventoryUnit extends Document {
  product: Types.ObjectId;
  serial: string;
  status: UnitStatus;
  unitCost?: number;
  location?: string;
  receipt?: Types.ObjectId;
  order?: Types.ObjectId;
  warranty?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = new Schema<IInventoryUnit>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    serial: { type: String, required: true, trim: true, maxlength: 80 },
    status: { type: String, required: true },
    unitCost: Number,
    location: { type: String, maxlength: 80 },
    receipt: { type: Schema.Types.ObjectId, ref: 'SupplierReceipt' },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    warranty: { type: String, maxlength: 200 },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);
unitSchema.index({ serial: 1 }, { unique: true });
unitSchema.index({ product: 1, status: 1, createdAt: 1 });

export const InventoryUnit = mongoose.model<IInventoryUnit>('InventoryUnit', unitSchema);

/* ---------------- Supplier deliveries ---------------- */

export interface IReceiptLine {
  product: Types.ObjectId;
  name: string;
  sku: string;
  qty: number;
  unitCost?: number;
  serials: string[];
  warranty?: string;
  /** How the received units were classified (always sums to qty). */
  result: { available: number; defective: number; underRepair: number; awaitingInspection: number };
  faultNotes?: string;
}

export interface ISupplierReceipt extends Document {
  supplier: string;
  reference?: string;
  receivedAt: Date;
  location?: string;
  notes?: string;
  evidenceUrls: string[];
  lines: IReceiptLine[];
  by?: Types.ObjectId;
  createdAt: Date;
}

const receiptSchema = new Schema<ISupplierReceipt>(
  {
    supplier: { type: String, required: true, trim: true, maxlength: 120 },
    reference: { type: String, trim: true, maxlength: 120 },
    receivedAt: { type: Date, required: true },
    location: { type: String, maxlength: 80 },
    notes: { type: String, maxlength: 2000 },
    evidenceUrls: { type: [String], default: [] },
    lines: [
      new Schema<IReceiptLine>(
        {
          product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          name: String,
          sku: String,
          qty: { type: Number, required: true, min: 1 },
          unitCost: Number,
          serials: { type: [String], default: [] },
          warranty: String,
          result: {
            available: { type: Number, default: 0 },
            defective: { type: Number, default: 0 },
            underRepair: { type: Number, default: 0 },
            awaitingInspection: { type: Number, default: 0 },
          },
          faultNotes: String,
        },
        { _id: true }
      ),
    ],
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
receiptSchema.index({ receivedAt: -1 });
receiptSchema.index({ supplier: 1 });

export const SupplierReceipt = mongoose.model<ISupplierReceipt>('SupplierReceipt', receiptSchema);

/* ---------------- Customer returns ---------------- */

export type ReturnOutcome = 'restock-new' | 'used' | 'repair' | 'defective' | 'write-off';

export interface IReturnLine {
  product: Types.ObjectId;
  name: string;
  sku: string;
  qty: number;
  serials: string[];
  reason: string;
  conditionNote?: string;
  unitCost?: number;
  assessed: { qty: number; outcome: ReturnOutcome; note?: string; targetProduct?: Types.ObjectId; at: Date; by?: Types.ObjectId }[];
}

export interface ICustomerReturn extends Document {
  order: Types.ObjectId;
  orderNumber: string;
  customer: Types.ObjectId;
  returnedAt: Date;
  status: 'awaiting-assessment' | 'assessed';
  lines: IReturnLine[];
  by?: Types.ObjectId;
  createdAt: Date;
}

const returnSchema = new Schema<ICustomerReturn>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    returnedAt: { type: Date, required: true },
    status: { type: String, enum: ['awaiting-assessment', 'assessed'], default: 'awaiting-assessment' },
    lines: [
      new Schema<IReturnLine>(
        {
          product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          name: String,
          sku: String,
          qty: { type: Number, required: true, min: 1 },
          serials: { type: [String], default: [] },
          reason: { type: String, required: true, maxlength: 300 },
          conditionNote: { type: String, maxlength: 500 },
          unitCost: Number,
          assessed: [
            new Schema(
              {
                qty: { type: Number, required: true, min: 1 },
                outcome: { type: String, enum: ['restock-new', 'used', 'repair', 'defective', 'write-off'], required: true },
                note: String,
                targetProduct: { type: Schema.Types.ObjectId, ref: 'Product' },
                at: { type: Date, default: Date.now },
                by: { type: Schema.Types.ObjectId, ref: 'User' },
              },
              { _id: false }
            ),
          ],
        },
        { _id: true }
      ),
    ],
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
returnSchema.index({ order: 1 });
returnSchema.index({ status: 1, createdAt: -1 });
returnSchema.index({ 'lines.product': 1 });

export const CustomerReturn = mongoose.model<ICustomerReturn>('CustomerReturn', returnSchema);

/* ---------------- Repairs ---------------- */

export const REPAIR_STATUSES = [
  'awaiting-diagnosis',
  'awaiting-parts',
  'in-repair',
  'repair-completed',
  'qc-pending',
  'qc-passed',
  'qc-failed',
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export interface IRepairRecord extends Document {
  product: Types.ObjectId;
  name: string;
  sku: string;
  qty: number;
  serial?: string;
  source: 'receipt' | 'return' | 'stock';
  receipt?: Types.ObjectId;
  customerReturn?: Types.ObjectId;
  reportedFault: string;
  diagnosis?: string;
  status: RepairStatus;
  cost: number;
  technician?: string;
  partsReplaced: string[];
  startedAt?: Date;
  completedAt?: Date;
  qcResult?: 'passed' | 'failed';
  qcNote?: string;
  qcBy?: Types.ObjectId;
  /** Where the unit(s) went when the repair was closed. */
  finalStatus?: 'new' | 'refurbished' | 'used' | 'defective' | 'write-off';
  finalProduct?: Types.ObjectId;
  closed: boolean;
  history: { status: RepairStatus; note?: string; at: Date; by?: Types.ObjectId }[];
  createdAt: Date;
  updatedAt: Date;
}

const repairSchema = new Schema<IRepairRecord>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    sku: String,
    qty: { type: Number, required: true, min: 1, default: 1 },
    serial: String,
    source: { type: String, enum: ['receipt', 'return', 'stock'], required: true },
    receipt: { type: Schema.Types.ObjectId, ref: 'SupplierReceipt' },
    customerReturn: { type: Schema.Types.ObjectId, ref: 'CustomerReturn' },
    reportedFault: { type: String, required: true, maxlength: 500 },
    diagnosis: { type: String, maxlength: 1000 },
    status: { type: String, enum: REPAIR_STATUSES, default: 'awaiting-diagnosis' },
    cost: { type: Number, default: 0, min: 0 },
    technician: { type: String, maxlength: 120 },
    partsReplaced: { type: [String], default: [] },
    startedAt: Date,
    completedAt: Date,
    qcResult: { type: String, enum: ['passed', 'failed'] },
    qcNote: String,
    qcBy: { type: Schema.Types.ObjectId, ref: 'User' },
    finalStatus: { type: String, enum: ['new', 'refurbished', 'used', 'defective', 'write-off'] },
    finalProduct: { type: Schema.Types.ObjectId, ref: 'Product' },
    closed: { type: Boolean, default: false },
    history: [
      new Schema(
        {
          status: { type: String, enum: REPAIR_STATUSES, required: true },
          note: String,
          at: { type: Date, default: Date.now },
          by: { type: Schema.Types.ObjectId, ref: 'User' },
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);
repairSchema.index({ closed: 1, updatedAt: -1 });
repairSchema.index({ product: 1, createdAt: -1 });
repairSchema.index({ serial: 1 });

export const RepairRecord = mongoose.model<IRepairRecord>('RepairRecord', repairSchema);
