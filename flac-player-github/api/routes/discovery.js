import express from "express";
import Song from "../models/Song.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // 1. Get unique artists from user's library
    const artists = await Song.distinct("artist");
    if (!artists || artists.length === 0) {
      return res.json([]);
    }

    // 2. Pick a random subset of 5 artists to search (to avoid rate limits and slow responses)
    const shuffled = artists.sort(() => 0.5 - Math.random());
    const selectedArtists = shuffled.slice(0, 5);

    let allTracks = [];
    
    // 3. Fetch from iTunes API
    await Promise.all(selectedArtists.map(async (artist) => {
      try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=song&limit=10`);
        if (response.ok) {
          const data = await response.json();
          // Filter to only include tracks where the artist name loosely matches (prevents bad search results)
          const validTracks = data.results.filter(t => 
            t.artistName.toLowerCase().includes(artist.toLowerCase()) || 
            artist.toLowerCase().includes(t.artistName.toLowerCase())
          );
          allTracks = allTracks.concat(validTracks);
        }
      } catch (err) {
        console.error("iTunes fetch error for", artist, err);
      }
    }));

    // 4. Sort by release date (newest first)
    allTracks.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
    
    // 5. Deduplicate by track name
    const uniqueTracks = [];
    const seen = new Set();
    for (const track of allTracks) {
      const key = track.trackName.toLowerCase() + track.artistName.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push({
          id: track.trackId.toString(),
          title: track.trackName,
          artist: track.artistName,
          album: track.collectionName,
          coverUrl: track.artworkUrl100?.replace('100x100bb', '500x500bb'),
          streamUrl: track.previewUrl,
          duration: track.trackTimeMillis ? Math.floor(track.trackTimeMillis / 1000) : null,
          created_at: track.releaseDate,
          isDiscovery: true
        });
      }
    }

    // Return the top 20 newest releases
    res.json(uniqueTracks.slice(0, 20));

  } catch (error) {
    console.error("Discovery error:", error);
    res.status(500).json({ error: "Failed to fetch discovery feed" });
  }
});

export default router;

