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

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'customer' | 'admin' | 'orders' | 'catalog' | 'support' | 'marketing'
  phone?: string;
  addresses: IAddress[];
  avatar?: string;
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

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 12, select: false },
    role: { type: String, enum: ['customer', 'admin', 'orders', 'catalog', 'support', 'marketing'], default: 'customer' },
    phone: { type: String },
    addresses: [addressSchema],
    avatar: { type: String },
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

export const User = mongoose.model<IUser>('User', userSchema);
