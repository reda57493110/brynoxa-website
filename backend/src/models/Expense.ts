import mongoose, { Schema, Document, Types } from 'mongoose';

export const EXPENSE_CATEGORIES = ['ads', 'packaging', 'delivery', 'rent', 'salaries', 'tools', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** A shop cost not tied to one order (ads, packaging, rent…). Counted in Admin → Profit. */
export interface IExpense extends Document {
  label: string;
  category: ExpenseCategory;
  amount: number;
  /** Day the money was spent (store timezone midnight, stored as UTC). */
  date: Date;
  note?: string;
  by?: Types.ObjectId;
}

const expenseSchema = new Schema<IExpense>(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'other' },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, index: true },
    note: { type: String, trim: true, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
