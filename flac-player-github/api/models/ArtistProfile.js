import mongoose from 'mongoose';

const artistProfileSchema = new mongoose.Schema({
  artist: { type: String, required: true, unique: true },
  portrait_path: { type: String },
  background_path: { type: String },
  updated_at: { type: Date, default: Date.now }
});

export default mongoose.model('ArtistProfile', artistProfileSchema);
