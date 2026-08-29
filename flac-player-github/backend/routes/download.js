import express from "express";
import { v2 as cloudinary } from "cloudinary";
import ytdl from "yt-dlp-exec";
import path from "path";
import os from "os";
import fs from "fs";
import { createHash } from "crypto";
import Song from "../models/Song.js";
import { fetchAndSaveArtistProfile } from "./artists.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { title, artist, album, coverUrl, releaseDate } = req.body;
  if (!title || !artist) {
    return res.status(400).json({ error: "Title and artist are required" });
  }

  try {
    const searchQuery = `ytsearch1:${artist} ${title} audio`;
    const tempFilePath = path.join(os.tmpdir(), `karma_${Date.now()}.m4a`);

    // Download audio to temp file without requiring ffmpeg
    await ytdl(searchQuery, {
      format: "bestaudio[ext=m4a]/bestaudio",
      output: tempFilePath,
      noPlaylist: true,
    });

    if (!fs.existsSync(tempFilePath)) {
      throw new Error("Download failed, temp file not found.");
    }

    // Upload audio to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
      folder: "karmaplay",
      resource_type: "video"
    });

    fs.unlinkSync(tempFilePath); // Clean up

    // Calculate duration from Cloudinary or leave null
    const duration = uploadResult.duration ? Math.floor(uploadResult.duration) : null;
    const file_size = uploadResult.bytes;
    
    // Use the provided coverUrl (from iTunes) and upload it to Cloudinary as well
    let finalCoverUrl = null;
    if (coverUrl) {
      try {
        const coverResult = await cloudinary.uploader.upload(coverUrl, {
          folder: "karmaplay/covers",
          resource_type: "image",
          format: "jpg"
        });
        finalCoverUrl = coverResult.secure_url;
      } catch (err) {
        console.error("Cover upload failed:", err);
        finalCoverUrl = coverUrl; // Fallback to original URL
      }
    }

    // Save to MongoDB
    const song = await Song.create({
      title,
      artist,
      album: album || "Unknown Album",
      cover_path: finalCoverUrl,
      file_path: uploadResult.secure_url,
      file_size,
      duration,
      created_at: releaseDate ? new Date(releaseDate) : Date.now(),
      // Adding a dummy hash for now
      file_hash: createHash("sha256").update(uploadResult.secure_url).digest("hex")
    });

    // Fetch artist profile asynchronously
    if (artist && artist.toLowerCase() !== "unknown artist") {
      fetchAndSaveArtistProfile(artist).catch(console.error);
    }

    res.json({ ok: true, song: { id: song._id, title, artist, coverUrl: finalCoverUrl } });
  } catch (error) {
    console.error("Autonomous download error:", error);
    res.status(500).json({ error: "Failed to download song autonomously" });
  }
});

export default router;

