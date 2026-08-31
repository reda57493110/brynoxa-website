import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Wishlist } from '../models/Wishlist';
import { Notification } from '../models/Notification';
import { Review } from '../models/Review';
import { isProd } from '../config/env';

const nextEmail = process.env.NEW_OWNER_EMAIL?.trim().toLowerCase();

async function changeOwnerEmail() {
  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    throw new Error('Set NEW_OWNER_EMAIL to a valid email address');
  }

  await connectDB();

  const conflictingUser = await User.findOne({ email: nextEmail });
  const owners = await User.find({ role: 'admin' });
  if (owners.length !== 1) {
    throw new Error(`Expected exactly one Owner account, found ${owners.length}`);
  }

  const owner = owners[0];
  if (conflictingUser && conflictingUser._id.toString() !== owner._id.toString()) {
    if (
      process.env.DELETE_CONFLICTING_CUSTOMER !== 'true' ||
      conflictingUser.role !== 'customer' ||
      conflictingUser.isGuest
    ) {
      throw new Error('The target email already belongs to another account');
    }
  }
  if (owner.email === nextEmail) {
    console.log('Owner email is already up to date');
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (conflictingUser && conflictingUser._id.toString() !== owner._id.toString()) {
        await Promise.all([
          Wishlist.deleteOne({ user: conflictingUser._id }, { session }),
          Notification.deleteMany({ user: conflictingUser._id }, { session }),
          Review.deleteMany({ user: conflictingUser._id }, { session }),
          User.deleteOne({ _id: conflictingUser._id }, { session }),
        ]);
      }
      owner.email = nextEmail;
      owner.emailVerified = !isProd;
      owner.refreshToken = undefined;
      await owner.save({ session, validateBeforeSave: false });
    });
  } finally {
    await session.endSession();
  }
  console.log(
    isProd
      ? 'Owner email updated. The account must verify the new email before login.'
      : 'Owner email updated.'
  );
}

changeOwnerEmail()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
