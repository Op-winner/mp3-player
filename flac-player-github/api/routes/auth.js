import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
export const JWT_SECRET = process.env.JWT_SECRET || "karma-play-super-secret-key-change-in-prod";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Username already taken" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password_hash: hash });

    const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user._id, username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import mongoose from "mongoose";

// Middleware to protect routes
export const requireAuth = (req, res, next) => {
  if (req.method === 'GET' && (req.path.endsWith('/stream') || req.path.endsWith('/cover') || req.path.includes('/image/'))) {
    return next();
  }

  let token = req.headers.authorization?.split(" ")[1];
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validate if the ID from the token is a valid MongoDB ObjectId
    // If it's not, it means this is an old SQLite token from before the MERN migration
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    
    req.user = decoded; // { id, username }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

export default router;
