import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';
import { createHash } from 'crypto';
import Song from '../models/Song.js';
import { fetchAndSaveArtistProfile } from './artists.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { title, artist, album, coverUrl, releaseDate } = req.body;
  if (!title || !artist) return res.status(400).json({ error: 'Title and artist are required' });

  try {
    const query = \\ \ audio\;
    const searchResult = await ytSearch(query);
    const video = searchResult.videos[0];
    
    if (!video) throw new Error('Could not find song on YouTube.');

    const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });

    // Upload directly to Cloudinary from the stream!
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'karmaplay', resource_type: 'video' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.pipe(uploadStream);
    });

    const duration = uploadResult.duration ? Math.floor(uploadResult.duration) : null;
    const file_size = uploadResult.bytes;
    
    let finalCoverUrl = null;
    if (coverUrl) {
      try {
        const coverResult = await cloudinary.uploader.upload(coverUrl, {
          folder: 'karmaplay/covers',
          resource_type: 'image',
          format: 'jpg'
        });
        finalCoverUrl = coverResult.secure_url;
      } catch (err) {
        finalCoverUrl = coverUrl;
      }
    }

    const song = await Song.create({
      title,
      artist,
      album: album || 'Unknown Album',
      cover_path: finalCoverUrl,
      file_path: uploadResult.secure_url,
      file_size,
      duration,
      created_at: releaseDate ? new Date(releaseDate) : Date.now(),
      file_hash: createHash('sha256').update(uploadResult.secure_url).digest('hex')
    });

    if (artist && artist.toLowerCase() !== 'unknown artist') {
      fetchAndSaveArtistProfile(artist).catch(console.error);
    }

    res.json({ ok: true, song: { id: song._id, title, artist, coverUrl: finalCoverUrl } });
  } catch (error) {
    console.error('Autonomous download error:', error);
    res.status(500).json({ error: 'Failed to download song autonomously' });
  }
});

export default router;
