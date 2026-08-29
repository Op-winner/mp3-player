import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter, { requireAuth } from "./routes/auth.js";
import songsRouter from "./routes/songs.js";
import playlistsRouter from "./routes/playlists.js";
import artistsRouter from "./routes/artists.js";
import discoveryRouter from "./routes/discovery.js";
import downloadRouter from "./routes/download.js";
import connectDB from "./db.js";
import "./watcher.js"; // Initialize watcher

const app = express();
const PORT = process.env.PORT || 4000;

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/songs", requireAuth, songsRouter);
app.use("/api/playlists", requireAuth, playlistsRouter);
app.use("/api/artists", requireAuth, artistsRouter);
app.use("/api/discovery", requireAuth, discoveryRouter);
app.use("/api/download", requireAuth, downloadRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || "Upload failed" });
  next();
});

app.listen(PORT, () => {
  console.log(`FLAC player backend running on http://localhost:${PORT}`);
});

