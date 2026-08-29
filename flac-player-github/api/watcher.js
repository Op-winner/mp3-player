import chokidar from "chokidar";
import path from "path";
import fs from "fs";
import { parseFile } from "music-metadata";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { fetchLyricsFromLRCLIB } from "./routes/songs.js";
import Song from "./models/Song.js";

const watchDir = path.join(process.cwd(), "watch_folder");
const coverDir = path.join(process.cwd(), "uploads", "covers");

if (!fs.existsSync(watchDir)) fs.mkdirSync(watchDir, { recursive: true });
if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

const watcher = chokidar.watch(watchDir, {
  ignored: /(^|[\/\\])\../, 
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher.on('add', async (filePath) => {
  if (!/\.(flac|mp3|m4a|aac|ogg|oga|wav|webm|opus|aiff|aif|alac)$/i.test(filePath)) return;

  try {
    const metadata = await parseFile(filePath);
    const common = metadata.common || {};
    const format = metadata.format || {};
    
    const originalName = path.basename(filePath);
    const filename = path.basename(originalName, path.extname(originalName));
    const filenameParts = filename.split(/\s[-_]\s/).map(p => p.trim()).filter(Boolean);
    
    const title = common.title || (filenameParts.length > 1 ? filenameParts.slice(1).join(" - ") : filename);
    const artist = common.artist || (filenameParts.length > 1 ? filenameParts[0] : "Unknown Artist");
    const album = common.album || "Unknown Album";
    const duration = format.duration || null;
    const fileHash = await hashFile(filePath);

    // Skip if already in DB
    const existing = await Song.findOne({ file_hash: fileHash });
    if (existing) {
      console.log(`[Watcher] Skipped duplicate: ${originalName}`);
      return;
    }

    const lyrics = await fetchLyricsFromLRCLIB(title, artist, album, duration);

    let coverPath = null;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const ext = pic.format && pic.format.toLowerCase().includes("png") ? "png" : "jpg";
      const coverFilename = `${nanoid()}.${ext}`;
      fs.writeFileSync(path.join(coverDir, coverFilename), pic.data);
      coverPath = coverFilename;
    }

    const stat = fs.statSync(filePath);

    await Song.create({
      title,
      artist,
      album,
      year: common.year || null,
      genre: common.genre?.[0] || null,
      track_no: common.track?.no || null,
      duration,
      sample_rate: format.sampleRate || null,
      bits_per_sample: format.bitsPerSample || null,
      channels: format.numberOfChannels || null,
      bitrate: format.bitrate ? Math.round(format.bitrate) : null,
      file_size: stat.size,
      file_path: filePath,
      cover_path: coverPath,
      file_hash: fileHash,
      lyrics
    });

    console.log(`[Watcher] Auto-ingested: ${title} by ${artist}`);
  } catch (err) {
    console.error(`[Watcher] Failed to ingest ${filePath}:`, err.message);
  }
});

console.log(`[Watcher] Listening for new audio files in ${watchDir}...`);
