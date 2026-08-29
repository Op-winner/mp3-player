import mongoose from "mongoose";
import "dotenv/config";

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.useDb("karmaplay");
  const songs = await db.collection("songs").find({}).sort({created_at: -1}).limit(1).toArray();
  console.log(JSON.stringify(songs, null, 2));
  process.exit(0);
}
check();
