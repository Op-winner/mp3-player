import express from "express";
import { createHash } from "crypto";
import multer from "multer";
import path from "path";
import { parseBuffer } from "music-metadata";
import { v2 as cloudinary } from "cloudinary";
import Song from "../models/Song.js";
import { fetchAndSaveArtistProfile } from "./artists.js";

// Cloudinary auto-configures using the CLOUDINARY_URL environment variable.
const AUDIO_EXTENSIONS = /\.(flac|mp3|m4a|aac|ogg|oga|wav|webm|opus|aiff|aif|alac)$/i;
const AUDIO_TYPES = new Set([
  "audio/aac", "audio/flac", "audio/mp3", "audio/mpeg", "audio/mp4",
  "audio/ogg", "audio/opus", "audio/wav", "audio/webm", "audio/x-aiff",
  "audio/x-flac", "audio/x-m4a", "audio/x-wav",
]);

const router = express.Router();

// Use memory storage instead of saving to disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const ok = AUDIO_EXTENSIONS.test(file.originalname) || AUDIO_TYPES.has(file.mimetype) || file.mimetype.startsWith("audio/");
    if (!ok) return cb(new Error("Unsupported audio format"));
    cb(null, true);
  },
});

const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

// Helper to upload a buffer stream to Cloudinary
const uploadToCloudinary = (buffer, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: "karmaplay" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

router.post("/upload", upload.array("files", 50), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });
  const results = [];
  
  for (const file of req.files) {
    try {
      // 1. Read metadata from memory buffer
      const metadata = await parseBuffer(file.buffer, file.mimetype);
      const common = metadata.common || {};
      const format = metadata.format || {};
      const smart = await enrichMetadata(common, file.originalname);
      
      const title = smart.title || path.basename(file.originalname, path.extname(file.originalname));
      const artist = smart.artist || "Unknown Artist";
      const album = smart.album || "Unknown Album";
      const duration = format.duration || null;
      
      // 2. Hash the buffer to prevent duplicates
      const fileHash = createHash("sha256").update(file.buffer).digest("hex");
      const existing = await Song.findOne({ $or: [ { file_hash: fileHash }, { title, artist } ] });
      
      let lyrics = null;
      if (!existing || !existing.lyrics) {
        lyrics = await fetchLyricsFromLRCLIB(title, artist, album, duration);
      } else {
        lyrics = existing.lyrics;
      }

      if (existing && qualityScore(existing) >= qualityScore({ bitrate: format.bitrate, duration })) {
        results.push({ file: file.originalname, ok: true, skipped: true, reason: "duplicate-or-lower-quality", title });
        continue;
      }
      
      // 3. Upload to Cloudinary
      const audioResult = await uploadToCloudinary(file.buffer, "video"); // Cloudinary uses 'video' for audio
      
      let coverPath = null;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        try {
          const coverResult = await uploadToCloudinary(pic.data, "image");
          coverPath = coverResult.secure_url;
        } catch (e) {
          console.error("Failed to upload cover art to Cloudinary", e);
        }
      }

      if (existing) {
        await Song.deleteOne({ _id: existing._id });
      }

      // 4. Save to MongoDB
      const song = await Song.create({
        title, artist, album,
        year: smart.year || null,
        genre: smart.genre || null,
        track_no: (common.track && common.track.no) || null,
        duration,
        sample_rate: format.sampleRate || null,
        bits_per_sample: format.bitsPerSample || null,
        channels: format.numberOfChannels || null,
        bitrate: format.bitrate ? Math.round(format.bitrate) : null,
        file_size: file.size,
        file_path: audioResult.secure_url, // Now a Cloudinary URL!
        cover_path: coverPath,             // Now a Cloudinary URL!
        file_hash: fileHash,
        lyrics
      });

      // 5. Asynchronously fetch and cache the artist profile on Cloudinary
      if (artist && artist !== "Unknown Artist") {
        fetchAndSaveArtistProfile(artist).catch(console.error);
      }

      results.push({ id: song._id, title, artist, ok: true });
    } catch (err) {
      console.error(err);
      results.push({ file: file.originalname, ok: false, error: err.message });
    }
  }
  res.json({ results });
});

router.post("/sync-lyrics", async (req, res) => {
  const songs = await Song.find({ lyrics: null });
  let updated = 0;
  for (const song of songs) {
    const lyrics = await fetchLyricsFromLRCLIB(song.title, song.artist, song.album, song.duration);
    if (lyrics) {
      song.lyrics = lyrics;
      await song.save();
      updated++;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  res.json({ ok: true, scanned: songs.length, updated });
});

router.get("/", async (req, res) => {
  try {
    const songs = await Song.find().sort({ created_at: -1 }).lean();
    res.json(songs.map(song => toPublicSong(song, req.user?.id)));
  } catch (error) {
    res.status(503).json({ error: "Database unavailable" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).lean();
    if (!song) return res.status(404).json({ error: "Song not found" });
    res.json(toPublicSong(song, req.user?.id));
  } catch(e) { res.status(404).json({ error: "Song not found" }); }
});

router.patch("/:id/like", async (req, res) => {
  const liked = req.body.liked;
  const update = liked ? { $addToSet: { liked_by: req.user.id } } : { $pull: { liked_by: req.user.id } };
  const song = await Song.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!song) return res.status(404).json({ error: "Song not found" });
  res.json({ ok: true, liked: Boolean(liked) });
});

router.get("/:id/cover", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song || !song.cover_path) return res.status(404).end();
    // Redirect frontend directly to the Cloudinary image URL
    res.redirect(song.cover_path);
  } catch(e) { res.status(404).end(); }
});

router.post("/:id/cover", posterUpload.single("cover"), async (req, res) => {
  const song = await Song.findById(req.params.id);
  if (!song) return res.status(404).json({ error: "Song not found" });
  if (!req.file) return res.status(400).json({ error: "Please choose an image poster" });
  
  try {
    const coverResult = await uploadToCloudinary(req.file.buffer, "image");
    song.cover_path = coverResult.secure_url;
    await song.save();
    res.json({ ok: true, coverUrl: `/api/songs/${song._id}/cover` });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload to Cloudinary" });
  }
});

router.get("/:id/stream", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).end();

    const quality = req.query.quality;
    if (quality) {
      // Cloudinary allows on-the-fly transcoding by injecting parameters into the URL!
      // Example: https://res.cloudinary.com/xyz/video/upload/v123/karmaplay/song.mp3 
      // Becomes: https://res.cloudinary.com/xyz/video/upload/br_128k/v123/karmaplay/song.mp3
      const transformedUrl = song.file_path.replace('/upload/', '/upload/br_128k/');
      return res.redirect(transformedUrl);
    }

    // Otherwise, stream the original file directly from Cloudinary
    res.redirect(song.file_path);
  } catch(e) { res.status(404).end(); }
});

router.patch("/:id", async (req, res) => {
  const data = req.body;
  const song = await Song.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!song) return res.status(404).json({ error: "Song not found" });
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  const song = await Song.findByIdAndDelete(req.params.id);
  if (!song) return res.status(404).json({ error: "Song not found" });
  res.json({ ok: true });
});

function toPublicSong(song, userId) {
  const isLiked = userId && song.liked_by?.some(id => id.toString() === userId.toString());
  return {
    id: song._id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    year: song.year,
    genre: song.genre,
    trackNo: song.track_no,
    duration: song.duration,
    sampleRate: song.sample_rate,
    bitsPerSample: song.bits_per_sample,
    channels: song.channels,
    bitrate: song.bitrate,
    format: path.extname(song.file_path).slice(1).toUpperCase() || "MP3",
    fileSize: song.file_size,
    fileHash: song.file_hash,
    liked: !!isLiked,
    hasCover: !!song.cover_path,
    lyrics: song.lyrics || null,
    streamUrl: `/api/songs/${song._id}/stream`,
    coverUrl: song.cover_path ? `/api/songs/${song._id}/cover` : null,
  };
}

function qualityScore(song) {
  if (!song) return 0;
  return (song.bitrate || 0) + (song.duration || 0);
}

async function enrichMetadata(common, originalName) {
  const filename = path.basename(originalName, path.extname(originalName));
  const filenameParts = filename.split(/\s[-_]\s/).map((part) => part.trim()).filter(Boolean);
  const fallback = {
    title: common.title || (filenameParts.length > 1 ? filenameParts.slice(1).join(" - ") : filename),
    artist: common.artist || (filenameParts.length > 1 ? filenameParts[0] : null),
    album: common.album || null,
    genre: common.genre?.[0] || null,
    year: common.year || null,
  };
  return fallback;
}

export async function fetchLyricsFromLRCLIB(title, artist, album, durationSec) {
  if (!title || !artist) return null;
  const url = new URL("https://lrclib.net/api/get");
  url.searchParams.set("track_name", title);
  url.searchParams.set("artist_name", artist);
  if (album) url.searchParams.set("album_name", album);
  if (durationSec) url.searchParams.set("duration", Math.round(durationSec).toString());
  try {
    const res = await fetch(url.toString(), { headers: { "User-Agent": "KarmaPlay/1.0.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.syncedLyrics || data.plainLyrics || null;
  } catch (err) { return null; }
}

export default router;
