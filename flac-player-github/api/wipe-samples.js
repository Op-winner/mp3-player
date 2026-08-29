import mongoose from "mongoose";

async function wipeAllSamples() {
  const uri = "mongodb://karmarp8082_db_user:K7rFMtbIkZqoufk1@ac-g2kf7du-shard-00-00.ngxncey.mongodb.net:27017,ac-g2kf7du-shard-00-01.ngxncey.mongodb.net:27017,ac-g2kf7du-shard-00-02.ngxncey.mongodb.net:27017/admin?replicaSet=atlas-vbihf0-shard-0&ssl=true&authSource=admin";
  
  try {
    await mongoose.connect(uri);
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    let droppedCount = 0;
    for (const dbInfo of databases) {
      const dbName = dbInfo.name;
      if (dbName.startsWith("sample_")) {
        console.log(`Dropping ${dbName}...`);
        await mongoose.connection.useDb(dbName).dropDatabase();
        droppedCount++;
      }
    }
    console.log(`Successfully dropped ${droppedCount} remaining sample databases!`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
wipeAllSamples();
