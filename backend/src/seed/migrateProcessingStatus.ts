import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri || uri === 'memory') {
    console.log('Skip migrate: no MongoDB URI')
    return
  }
  await mongoose.connect(uri)
  const result = await mongoose.connection.db!
    .collection('orders')
    .updateMany({ orderStatus: 'processing' }, { $set: { orderStatus: 'confirmed' } })
  console.log(`Migrated ${result.modifiedCount} order(s) from processing to confirmed`)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
