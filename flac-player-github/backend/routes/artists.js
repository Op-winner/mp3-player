import express from "express";
import { v2 as cloudinary } from "cloudinary";
import ArtistProfile from "../models/ArtistProfile.js";

const router = express.Router();

export async function fetchAndSaveArtistProfile(artistName) {
  const artist = decodeURIComponent(artistName).trim();
  const key = artist.toLowerCase();
  
  const cached = await ArtistProfile.findOne({ artist: key });
  
  // If we already have valid cloudinary URLs (starting with http), just return them
  if (cached && cached.portrait_path && cached.portrait_path.startsWith("http")) {
    return cached;
  }

  // If we previously cached a failure (null) recently, skip refetching
  // (We'll assume if it's null, we don't try again immediately, but here we can just try again if we want.
  //  Let's only skip if it's not null, meaning we don't have it).
  if (cached && cached.portrait_path === null) {
    // Optionally we could retry, but to avoid spamming APIs, we return the cached null
    return cached;
  }

  let portraitSource;
  try {
    const dzRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`);
    if (dzRes.ok) {
      const data = await dzRes.json();
      if (data.data && data.data.length > 0) {
        portraitSource = data.data[0].picture_xl;
      }
    }
  } catch (error) {
    console.error("Deezer fetch error:", error);
  }

  if (!portraitSource) {
    const updated = await ArtistProfile.findOneAndUpdate(
      { artist: key },
      { portrait_path: null, background_path: null, updated_at: Date.now() },
      { upsert: true, new: true }
    );
    return updated;
  }

  let backgroundSource;
  let useBlur = false;
  try {
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(artist)}&utf8=&format=json`);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.query?.search?.length > 0) {
        const title = searchData.query.search[0].title;
        const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (normalizedTitle.includes(normalizedArtist) || normalizedArtist.includes(normalizedTitle)) {
          const sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            if (sumData.originalimage?.source) {
              backgroundSource = sumData.originalimage.source;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Wiki fetch error:", error);
  }

  if (!backgroundSource) {
    backgroundSource = portraitSource;
  }

  try {
    // Upload Deezer image directly to Cloudinary via URL
    // Use format 'auto' and quality 'auto' for automatic compression
    const result = await cloudinary.uploader.upload(portraitSource, {
      folder: "karmaplay/artists",
      resource_type: "image",
      format: "jpg",
      transformation: [
        { quality: "auto:good", fetch_format: "auto" }
      ]
    });
    const portraitUrl = result.secure_url;
    
    let backgroundUrl = portraitUrl;
    if (backgroundSource !== portraitSource) {
      const bgResult = await cloudinary.uploader.upload(backgroundSource, {
        folder: "karmaplay/artists/backgrounds",
        resource_type: "image",
        format: "jpg",
        transformation: [
          { width: 1920, height: 600, crop: "fill", gravity: "auto" },
          { quality: "auto:good", fetch_format: "auto" }
        ]
      });
      backgroundUrl = bgResult.secure_url;
    } else {
      backgroundUrl = portraitUrl.replace("/upload/", "/upload/w_1920,h_600,c_fill,g_auto,e_blur:200,q_auto,f_auto/");
    }
    
    const updated = await ArtistProfile.findOneAndUpdate(
      { artist: key },
      { portrait_path: portraitUrl, background_path: backgroundUrl, updated_at: Date.now() },
      { upsert: true, new: true }
    );
    return updated;
  } catch (error) {
    console.error("Cloudinary artist upload failed:", error);
    return cached || { artist: key, portrait_path: null, background_path: null };
  }
}

router.get("/:artist", async (req, res) => {
  const profile = await fetchAndSaveArtistProfile(req.params.artist);
  res.json({
    artist: profile.artist,
    portraitUrl: profile.portrait_path || null,
    backgroundUrl: profile.background_path || null,
  });
});

router.get("/:artist/image", async (req, res) => {
  const profile = await fetchAndSaveArtistProfile(req.params.artist);
  if (!profile || !profile.portrait_path) {
    return res.status(404).end();
  }
  res.redirect(profile.portrait_path);
});

export default router;
