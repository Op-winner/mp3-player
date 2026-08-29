import mongoose from "mongoose";
import "dotenv/config";

async function wipe() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/karmaplay";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB, dropping database...");
  await mongoose.connection.db.dropDatabase();
  console.log("Database dropped successfully.");
  process.exit(0);
}
wipe();
