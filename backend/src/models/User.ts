import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddress {
  _id?: Types.ObjectId;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export type CustomerType = 'retail' | 'wholesale' | 'business';
export type WholesaleStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Company details for wholesale / business customers. */
export interface IBusinessInfo {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** ICE / RC / tax number, only where the customer provides it. */
  taxId?: string;
}

/** Wholesale application and approval. Access is only granted when status is "approved". */
export interface IWholesaleAccount {
  status: WholesaleStatus;
  requestedType?: 'wholesale' | 'business';
  applicationMessage?: string;
  requestedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
  /** Id of a tier in Settings.wholesaleTiers. */
  tierId?: string;
  paymentTerms?: string;
}

/** Account events shown on the admin customer timeline. */
export interface IAccountActivity {
  type: string;
  note: string;
  at: Date;
  by?: Types.ObjectId;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'customer' | 'admin' | 'orders' | 'catalog' | 'support' | 'marketing'
  phone?: string;
  addresses: IAddress[];
  avatar?: string;
  customerType: CustomerType;
  business?: IBusinessInfo;
  wholesale: IWholesaleAccount;
  billingAddress?: Partial<Omit<IAddress, '_id' | 'isDefault' | 'label'>>;
  /** Internal, staff-only notes about the customer. */
  adminNotes?: string;
  activity: IAccountActivity[];
  isActive: boolean;
  /** Checkout without password — cannot sign in until they set one */
  isGuest: boolean;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  refreshToken?: string;
  mfaEnabled: boolean;
  mfaSecretEncrypted?: string;
  mfaPendingSecretEncrypted?: string;
  mfaRecoveryCodeHashes: string[];
  failedLoginAttempts: number;
  lockedUntil?: Date;
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    label: { type: String, default: 'Home' },
    fullName: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    postalCode: { type: String, default: '00000' },
    country: { type: String, default: 'MA' },
    phone: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const businessSchema = new Schema<IBusinessInfo>(
  {
    companyName: { type: String, trim: true, maxlength: 120 },
    contactName: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 300 },
    taxId: { type: String, trim: true, maxlength: 60 },
  },
  { _id: false }
);

const wholesaleSchema = new Schema<IWholesaleAccount>(
  {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requestedType: { type: String, enum: ['wholesale', 'business'] },
    applicationMessage: { type: String, maxlength: 1000 },
    requestedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, maxlength: 500 },
    tierId: { type: String, maxlength: 24 },
    paymentTerms: { type: String, maxlength: 200 },
  },
  { _id: false }
);

const billingAddressSchema = new Schema(
  {
    fullName: { type: String },
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'MA' },
    phone: { type: String },
  },
  { _id: false }
);

const activitySchema = new Schema<IAccountActivity>(
  {
    type: { type: String, required: true },
    note: { type: String, required: true, maxlength: 500 },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['customer', 'admin', 'orders', 'catalog', 'support', 'marketing'], default: 'customer' },
    phone: { type: String },
    addresses: [addressSchema],
    avatar: { type: String },
    customerType: { type: String, enum: ['retail', 'wholesale', 'business'], default: 'retail' },
    business: { type: businessSchema, default: undefined },
    wholesale: { type: wholesaleSchema, default: () => ({ status: 'none' }) },
    billingAddress: { type: billingAddressSchema, default: undefined },
    adminNotes: { type: String, maxlength: 5000, select: false },
    activity: { type: [activitySchema], default: [], select: false },
    isActive: { type: Boolean, default: true },
    isGuest: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: true },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretEncrypted: { type: String, select: false },
    mfaPendingSecretEncrypted: { type: String, select: false },
    mfaRecoveryCodeHashes: { type: [String], select: false, default: [] },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const bcrypt = await import('bcryptjs');
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate: string) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ role: 1, customerType: 1 });
userSchema.index({ 'wholesale.status': 1 });

export const User = mongoose.model<IUser>('User', userSchema);
