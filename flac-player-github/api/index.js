import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import songsRouter from './routes/songs.js';
import playlistsRouter from './routes/playlists.js';
import discoveryRouter from './routes/discovery.js';
import artistsRouter from './routes/artists.js';
import downloadRouter from './routes/download.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    isConnected = db.connections[0].readyState;
    console.log("MongoDB connected in Vercel Serverless");
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/songs", songsRouter);
app.use("/api/playlists", playlistsRouter);
app.use("/api/discovery", discoveryRouter);
app.use("/api/artists", artistsRouter);
app.use("/api/download", downloadRouter);

export default app;
