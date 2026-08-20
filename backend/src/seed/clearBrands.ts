import { connectDB } from '../config/db';
import { Brand } from '../models/Brand';

async function clearBrands() {
  await connectDB();
  const before = await Brand.countDocuments();
  const result = await Brand.deleteMany({});
  console.log(`Cleared brands: ${result.deletedCount} (was ${before}).`);
  process.exit(0);
}

clearBrands().catch((err) => {
  console.error(err);
  process.exit(1);
});
