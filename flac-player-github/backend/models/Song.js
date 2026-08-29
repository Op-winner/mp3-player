import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, default: 'Unknown Artist' },
  album: { type: String, default: 'Unknown Album' },
  year: { type: Number },
  genre: { type: String },
  track_no: { type: Number },
  duration: { type: Number },
  sample_rate: { type: Number },
  bits_per_sample: { type: Number },
  channels: { type: Number },
  bitrate: { type: Number },
  file_size: { type: Number },
  file_path: { type: String, required: true },
  cover_path: { type: String },
  file_hash: { type: String },
  lyrics: { type: String },
  liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Song', songSchema);
