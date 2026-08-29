import "dotenv/config";
import mongoose from "mongoose";
import { fetchLyricsFromLRCLIB } from "./routes/songs.js";
import Song from "./models/Song.js";

async function run() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/karmaplay';
  await mongoose.connect(mongoURI);
  console.log(`Connected to MongoDB at ${mongoURI}`);

  console.log("Scanning library for songs without lyrics...");
  const songs = await Song.find({ lyrics: null });
  let updated = 0;
  
  for (const song of songs) {
    console.log(`Fetching lyrics for: ${song.title} by ${song.artist}...`);
    const lyrics = await fetchLyricsFromLRCLIB(song.title, song.artist, song.album, song.duration);
    if (lyrics) {
      song.lyrics = lyrics;
      await song.save();
      updated++;
      console.log(`  -> Found lyrics!`);
    } else {
      console.log(`  -> Not found on LRCLIB.`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\nSync complete! Scanned ${songs.length} songs. Updated ${updated} songs with lyrics.`);
  process.exit(0);
}

run();

