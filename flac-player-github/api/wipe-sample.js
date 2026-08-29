import mongoose from "mongoose";

async function wipeSample() {
  const uri = "mongodb://karmarp8082_db_user:K7rFMtbIkZqoufk1@ac-g2kf7du-shard-00-00.ngxncey.mongodb.net:27017,ac-g2kf7du-shard-00-01.ngxncey.mongodb.net:27017,ac-g2kf7du-shard-00-02.ngxncey.mongodb.net:27017/sample_mflix?replicaSet=atlas-vbihf0-shard-0&ssl=true&authSource=admin";
  
  try {
    await mongoose.connect(uri);
    console.log("Connected to sample_mflix database...");
    await mongoose.connection.db.dropDatabase();
    console.log("Dropped sample_mflix successfully!");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
wipeSample();
