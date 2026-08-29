import express from "express";
import Playlist from "../models/Playlist.js";
import Song from "../models/Song.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const playlists = await Playlist.find({ user_id: req.user.id }).sort({ pinned: -1, created_at: -1 }).populate('songs.song_id');
  
  const mapped = playlists.map(p => {
    return {
      id: p._id,
      name: p.name,
      pinned: p.pinned,
      songs: p.songs.sort((a, b) => a.position - b.position).map(s => {
        if (!s.song_id) return null; // If song was deleted
        return {
          id: s.song_id._id,
          title: s.song_id.title,
          artist: s.song_id.artist,
          album: s.song_id.album,
          duration: s.song_id.duration,
          coverUrl: s.song_id.cover_path ? `/api/songs/${s.song_id._id}/cover` : null
        };
      }).filter(Boolean)
    };
  });
  res.json(mapped);
});

router.get("/:id", async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, user_id: req.user.id }).populate('songs.song_id');
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });

    res.json({
      id: playlist._id,
      name: playlist.name,
      pinned: playlist.pinned,
      songs: playlist.songs.sort((a, b) => a.position - b.position).map(s => {
        if (!s.song_id) return null;
        return {
          id: s.song_id._id,
          title: s.song_id.title,
          artist: s.song_id.artist,
          album: s.song_id.album,
          duration: s.song_id.duration,
          coverUrl: s.song_id.cover_path ? `/api/songs/${s.song_id._id}/cover` : null
        };
      }).filter(Boolean)
    });
  } catch(e) { res.status(404).json({ error: "Playlist not found" }); }
});

router.post("/", async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: "Name required" });
  const playlist = await Playlist.create({
    name: req.body.name,
    user_id: req.user.id,
    songs: []
  });
  res.json({ id: playlist._id, name: playlist.name });
});

router.patch("/:id", async (req, res) => {
  const p = await Playlist.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id }, { name: req.body.name }, { new: true });
  if (!p) return res.status(404).json({ error: "Playlist not found" });
  res.json({ id: p._id, name: p.name });
});

router.delete("/:id", async (req, res) => {
  const p = await Playlist.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
  if (!p) return res.status(404).json({ error: "Playlist not found" });
  res.json({ ok: true });
});

router.patch("/:id/pin", async (req, res) => {
  const p = await Playlist.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id }, { pinned: req.body.pinned }, { new: true });
  if (!p) return res.status(404).json({ error: "Playlist not found" });
  res.json({ ok: true });
});

router.post("/:id/add", async (req, res) => {
  const { songId } = req.body;
  if (!songId) return res.status(400).json({ error: "Song ID required" });
  
  const playlist = await Playlist.findOne({ _id: req.params.id, user_id: req.user.id });
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });

  if (playlist.songs.some(s => s.song_id.toString() === songId)) {
    return res.status(400).json({ error: "Song already in playlist" });
  }

  playlist.songs.push({ song_id: songId, position: playlist.songs.length });
  await playlist.save();
  res.json({ ok: true });
});

router.post("/:id/remove", async (req, res) => {
  const { songId } = req.body;
  
  const playlist = await Playlist.findOne({ _id: req.params.id, user_id: req.user.id });
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });

  playlist.songs = playlist.songs.filter(s => s.song_id.toString() !== songId);
  playlist.songs.forEach((s, i) => s.position = i);
  await playlist.save();

  res.json({ ok: true });
});

router.patch("/:id/reorder", async (req, res) => {
  const { songs } = req.body; // Array of song IDs in new order
  const playlist = await Playlist.findOne({ _id: req.params.id, user_id: req.user.id });
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });

  const newOrder = [];
  songs.forEach((songId, i) => {
    const existing = playlist.songs.find(s => s.song_id.toString() === songId);
    if (existing) {
      newOrder.push({ song_id: songId, position: i });
    }
  });

  playlist.songs = newOrder;
  await playlist.save();
  res.json({ ok: true });
});

export default router;
