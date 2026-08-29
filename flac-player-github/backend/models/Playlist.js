import mongoose from 'mongoose';

const playlistSongSchema = new mongoose.Schema({
  song_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
  position: { type: Number, required: true }
}, { _id: false });

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  songs: [playlistSongSchema],
  pinned: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Playlist', playlistSchema);
