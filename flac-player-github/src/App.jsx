import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import Player from "./components/Player.jsx";
import Library from "./components/Library.jsx";
import PlaylistPanel from "./components/PlaylistPanel.jsx";
import Login from "./components/Login.jsx";
import { fetchSongs, fetchPlaylists, fetchPlaylist, fetchArtistProfile, addSongToPlaylist, removeSongFromPlaylist, reorderPlaylist, uploadSongs, formatDuration, getArtistNames, toggleLike } from "./api.js";

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("karma-play-user")); } catch { return null; }
  });
  
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [visibleSongs, setVisibleSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [artistProfile, setArtistProfile] = useState(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [navigation, setNavigation] = useState([{ type: "home" }]);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [compactSidebar, setCompactSidebar] = useState(() => localStorage.getItem("karma-compact-sidebar") === "true");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const restoredRef = useRef(false);

  const refreshSongs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchSongs();
      setSongs(data);
    } catch (err) {}
  }, [user]);

  const refreshPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchPlaylists();
      setPlaylists(data);
    } catch (err) {}
  }, [user]);

  useEffect(() => {
    const handleAuthExpired = () => setUser(null);
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (user) {
      refreshSongs();
      refreshPlaylists();
    }
  }, [user, refreshSongs, refreshPlaylists]);

  useEffect(() => {
    if (!user || restoredRef.current || songs.length === 0) return;
    const saved = JSON.parse(localStorage.getItem("karma-play-session") || "null");
    const savedIndex = saved ? songs.findIndex((song) => song.id === saved.songId) : -1;
    if (savedIndex >= 0) {
      setQueue(songs);
      setCurrentIndex(savedIndex);
    }
    restoredRef.current = true;
  }, [songs]);

  const handleFiles = async (files) => {
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith("audio/") || /\.(flac|mp3|m4a|aac|ogg|oga|wav|webm|opus|aiff|aif|alac)$/i.test(file.name));
    if (audioFiles.length === 0) return;
    setUploadError("");
    setUploading(true);
    setUploadProgress(0);
    try {
      const { results = [] } = await uploadSongs(audioFiles, setUploadProgress);
      const failed = results.filter((result) => !result.ok);
      if (failed.length) setUploadError(`${failed.length} file${failed.length === 1 ? "" : "s"} could not be imported: ${failed[0].error || "unsupported audio"}`);
      await refreshSongs();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Determine which list of songs is showing: all songs, or a specific playlist's songs
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (selectedPlaylistId === null) {
        setVisibleSongs(songs);
      } else if (selectedPlaylistId === "liked") {
        setVisibleSongs(songs.filter((song) => song.liked));
      } else {
        const pl = await fetchPlaylist(selectedPlaylistId);
        if (!cancelled) {
          const mapped = pl.songs.map((playlistSong) => songs.find((song) => song.id === playlistSong.id) || {
            id: playlistSong.id,
            title: playlistSong.title,
            artist: playlistSong.artist,
            album: playlistSong.album,
            duration: playlistSong.duration,
            sampleRate: playlistSong.sample_rate,
            bitsPerSample: playlistSong.bits_per_sample,
            bitrate: playlistSong.bitrate,
            fileSize: playlistSong.file_size,
            coverUrl: playlistSong.cover_path ? `/api/songs/${playlistSong.id}/cover` : null,
            streamUrl: `/api/songs/${playlistSong.id}/stream`,
          });
          setVisibleSongs(mapped);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylistId, songs, playlists]);

  const playSong = (song) => {
    if (song.isDiscovery) {
      setQueue([{ ...song, queueOrigin: "discovery" }]);
      setCurrentIndex(0);
      return;
    }
    const idx = visibleSongs.findIndex((s) => s.id === song.id);
    const playlist = playlists.find((item) => item.id === selectedPlaylistId);
    setQueue(visibleSongs.map((item) => ({ ...item, queueOrigin: selectedPlaylistId === null ? "library" : "playlist", queueSourceName: playlist?.name })));
    setCurrentIndex(idx);
  };

  const addToQueue = (song) => {
    setQueue((currentQueue) => [...currentQueue, { ...song, queueOrigin: "manual" }]);
    if (currentIndex < 0) setCurrentIndex(0);
  };

  const playNext = (song) => {
    if (currentIndex < 0) {
      setQueue([{ ...song, queueOrigin: "manual" }]);
      setCurrentIndex(0);
      return;
    }
    setQueue((currentQueue) => {
      const nextQueue = [...currentQueue];
      nextQueue.splice(currentIndex + 1, 0, { ...song, queueOrigin: "manual" });
      return nextQueue;
    });
  };

  const removeFromQueue = (index) => {
    setQueue((currentQueue) => currentQueue.filter((_, queueIndex) => queueIndex !== index));
    if (index < currentIndex) setCurrentIndex((value) => value - 1);
    if (index === currentIndex) setCurrentIndex((value) => Math.min(value, queue.length - 2));
  };

  const playArtistSong = (artistSongs, song) => {
    setQueue(artistSongs);
    setCurrentIndex(artistSongs.findIndex((item) => item.id === song.id));
    setArtistProfile(null);
  };

  const applyView = (view) => {
    setArtistProfile(view.type === "artist" ? view.artist : null);
    setShowNowPlaying(view.type === "now-playing");
  };

  const navigateTo = (view) => {
    setNavigation((history) => [...history.slice(0, navigationIndex + 1), view]);
    setNavigationIndex((index) => index + 1);
    applyView(view);
  };

  const navigateHistory = (direction) => {
    const nextIndex = navigationIndex + direction;
    if (nextIndex < 0 || nextIndex >= navigation.length) return;
    setNavigationIndex(nextIndex);
    applyView(navigation[nextIndex]);
  };

  const openArtist = (artist) => navigateTo({ type: "artist", artist });

  const openCollection = (collectionId) => {
    setSelectedPlaylistId(collectionId);
    setArtistProfile(null);
    setShowNowPlaying(false);
  };

  const songsByArtist = (artist) => songs.filter((song) => {
    return getArtistNames(song.artist).some((name) => name.toLowerCase() === artist.toLowerCase());
  });

  const playAllArtistSongs = (artist) => {
    const artistSongs = songsByArtist(artist);
    if (artistSongs.length === 0) return;
    setQueue(artistSongs);
    setCurrentIndex(0);
  };

  const addAllArtistSongs = (artist) => {
    const artistSongs = songsByArtist(artist);
    setQueue((currentQueue) => [...currentQueue, ...artistSongs.filter((song) => !currentQueue.some((queuedSong) => queuedSong.id === song.id))]);
  };

  const addPlaylistToQueue = async (playlistId) => {
    const playlist = await fetchPlaylist(playlistId);
    const playlistSongs = playlist.songs.map((playlistSong) => songs.find((song) => song.id === playlistSong.id)).filter(Boolean);
    setQueue((currentQueue) => [...currentQueue, ...playlistSongs.map((song) => ({ ...song, queueOrigin: "playlist", queueSourceName: playlist.name }))]);
    if (currentIndex < 0 && playlistSongs.length > 0) setCurrentIndex(0);
  };

  const clearUpcomingQueue = () => {
    if (currentIndex < 0 || !queue[currentIndex]) {
      setQueue([]);
      setCurrentIndex(-1);
      return;
    }
    setQueue(queue.filter((song, index) => index <= currentIndex || song.queueOrigin !== "manual"));
  };

  const toggleLike = async (song) => {
    await likeSong(song.id, !song.liked);
    await refreshSongs();
  };

  const currentSong = currentIndex >= 0 ? queue[currentIndex] : null;

  const toggleSidebar = () => {
    setCompactSidebar((compact) => {
      localStorage.setItem("karma-compact-sidebar", String(!compact));
      return !compact;
    });
  };

  const fuseOptions = useMemo(() => ({
    keys: [
      { name: "title", weight: 2 },
      { name: "artist", weight: 1.5 },
      { name: "album", weight: 1 },
      { name: "lyrics", weight: 0.5 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  }), []);

  const fuseGlobal = useMemo(() => new Fuse(songs, fuseOptions), [songs, fuseOptions]);

  const globalSearchResults = useMemo(() => {
    if (!searchQuery) return [];
    return fuseGlobal.search(searchQuery).slice(0, 5).map(res => res.item);
  }, [searchQuery, fuseGlobal]);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className={`app-shell ${compactSidebar ? "compact-sidebar" : ""}`}>
      <aside className="sidebar">
        <div className="brand-mark"><span>k</span></div>
        <div className="brand-name">Karma <strong>Play</strong></div>
        <button className="sidebar-mode-toggle" onClick={toggleSidebar} aria-label={compactSidebar ? "Use full sidebar" : "Use compact sidebar"} title={compactSidebar ? "Use full sidebar" : "Use compact sidebar"}>
          {compactSidebar ? "▥" : "◧"}
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className="nav-item" onClick={() => { openCollection(null); navigateTo({ type: "home" }); }}><span>▣</span> Your Library</button>
        </nav>
        <div className="sidebar-playlists">
          <div className="sidebar-label">Playlists</div>
          <PlaylistPanel
            playlists={playlists}
            refreshPlaylists={refreshPlaylists}
            selectedPlaylistId={selectedPlaylistId}
            onSelectPlaylist={openCollection}
            onAddPlaylistToQueue={addPlaylistToQueue}
            compact={compactSidebar}
            likedCount={songs.filter((song) => song.liked).length}
          />
        </div>
        <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {!compactSidebar && <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-dim)" }}>{user.username}</span>}
          <button 
            onClick={() => {
              localStorage.removeItem("karma-play-token");
              localStorage.removeItem("karma-play-user");
              setUser(null);
            }} 
            style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 13 }}
            title="Log out"
          >
            {compactSidebar ? "🚪" : "Log Out"}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-arrows"><button onClick={() => navigateHistory(-1)} disabled={navigationIndex === 0} aria-label="Back">‹</button><button onClick={() => navigateHistory(1)} disabled={navigationIndex === navigation.length - 1} aria-label="Forward">›</button></div>
            <button className="home-button" onClick={() => { openCollection(null); navigateTo({ type: "home" }); }} aria-label="Home" title="Home">⌂</button>
            <div className="search-box" style={{ position: "relative", overflow: "visible" }}>
              <span>⌕</span>
              <input 
                placeholder="What do you want to play?" 
                aria-label="Search your library" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              />
              {searchFocused && searchQuery && (
                <div className="search-dropdown" style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0, width: "100%", 
                  background: "var(--panel)", border: "1px solid var(--border)", 
                  borderRadius: 8, zIndex: 100, padding: 8,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  cursor: "default"
                }}>
                  {globalSearchResults.length > 0 ? (
                    globalSearchResults.map(song => (
                      <div 
                        key={song.id} 
                        className="search-result-item"
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px", borderRadius: 6, cursor: "pointer" }}
                        onClick={(e) => {
                          e.preventDefault();
                          const idx = songs.findIndex(s => s.id === song.id);
                          setQueue(songs);
                          setCurrentIndex(idx);
                          setSearchQuery("");
                          setSearchFocused(false);
                        }}
                      >
                        <div style={{ position: "relative", width: 40, height: 40, borderRadius: 4, background: song.coverUrl ? `url(${song.coverUrl}) center/cover` : "var(--panel-raised)", flexShrink: 0, overflow: "hidden" }}>
                          <div className="search-item-play-overlay">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14 }}>{song.title}</span>
                          <span style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Song • {song.artist}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "12px", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>No results found</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="topbar-actions"><button aria-label="Notifications">♧</button><button aria-label="Friends">♧</button><div className="profile-chip"><span className="profile-avatar">K</span> Karma listener <span>⌄</span></div></div>
          <div className="topbar-actions"><div className="profile-chip"><span className="profile-avatar">K</span> Karma listener <span>⌄</span></div></div>
        </header>
        <section className="content-scroll">
          {artistProfile ? (
            <ArtistProfile
              artist={artistProfile}
              songs={songsByArtist(artistProfile)}
              onPlaySong={(song, artistSongs) => playArtistSong(artistSongs, song)}
              onPlayAll={() => playAllArtistSongs(artistProfile)}
              onAddAll={() => addAllArtistSongs(artistProfile)}
            />
          ) : showNowPlaying && currentSong ? (
            <NowPlaying song={currentSong} onOpenArtist={openArtist} />
          ) : (
            <>
              {uploadError && <div className="upload-error">{uploadError}</div>}
              <div className="workspace-grid">
                <Library
                  songs={visibleSongs}
                  collectionName={selectedPlaylistId === null ? "All songs" : selectedPlaylistId === "liked" ? "Liked Songs" : playlists.find((playlist) => playlist.id === selectedPlaylistId)?.name || "Playlist"}
                  refreshSongs={refreshSongs}
                  onPlaySong={playSong}
                  currentSongId={currentSong?.id}
                  isPlaying={currentIndex >= 0}
                  playlists={playlists}
                  onAddToQueue={addToQueue}
                  onPlayNext={playNext}
                  onOpenArtist={openArtist}
                  onToggleLike={toggleLike}
                  onSelectPlaylist={openCollection}
                  onPlayAlbum={(album) => {
                    const albumSongs = songs.filter(s => s.album === album);
                    setQueue(albumSongs);
                    setCurrentIndex(0);
                  }}
                  onAddToPlaylist={async (playlistId, songId) => {
                    await addSongToPlaylist(playlistId, songId);
                    await refreshPlaylists();
                  }}
                  playlistId={selectedPlaylistId}
                  allSongs={songs}
                  onUpdatePlaylist={async () => await refreshPlaylists()}
                  onRemoveFromPlaylist={async (playlistId, songId) => {
                    await removeSongFromPlaylist(playlistId, songId);
                    await refreshPlaylists();
                    // if currently viewing this playlist, it will refresh via useEffect
                  }}
                  onReorderPlaylist={async (playlistId, songIds) => {
                    await reorderPlaylist(playlistId, songIds);
                    await refreshPlaylists();
                  }}
                />
              </div>
            </>
          )}
        </section>
      </main>
      {!queueOpen && <button className="add-music" onClick={() => fileInputRef.current?.click()} aria-label="Add music" title="Add music">
        {uploading ? `${uploadProgress}%` : "+"}
      </button>}
      <input ref={fileInputRef} type="file" accept="audio/*,.flac,.mp3,.m4a,.aac,.ogg,.wav,.webm,.opus,.aiff,.alac" multiple hidden onChange={(event) => handleFiles(event.target.files)} />
      <Player
        queue={queue}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearUpcomingQueue}
        onQueueVisibilityChange={setQueueOpen}
        onQueueEnd={() => {}}
        onOpenNowPlaying={() => navigateTo({ type: "now-playing" })}
        onOpenArtist={openArtist}
      />
    </div>
  );
}

function parseLRC(lrc) {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const result = [];
  const regex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/;
  for (const line of lines) {
    const match = regex.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      result.push({ time: min * 60 + sec, text: match[3].trim() });
    }
  }
  return result;
}

function NowPlaying({ song, onOpenArtist }) {
  const [time, setTime] = useState(0);
  const lyricsContainerRef = useRef(null);
  
  useEffect(() => {
    const onTime = (e) => setTime(e.detail);
    window.addEventListener('karma-time-update', onTime);
    return () => window.removeEventListener('karma-time-update', onTime);
  }, []);

  const parsedLyrics = parseLRC(song.lyrics);
  const activeLineIndex = parsedLyrics.length > 0 
    ? parsedLyrics.findLastIndex((line) => time >= line.time)
    : -1;

  useEffect(() => {
    if (activeLineIndex >= 0 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector('.lyric-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  return (
    <div className="now-playing-page">
      <div className="now-playing-hero">
        <div className="large-art" style={{ backgroundImage: song.coverUrl ? `url(${song.coverUrl})` : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))" }}>
          {!song.coverUrl && <span>♫</span>}
        </div>
        <div className="now-playing-copy">
          <p className="eyebrow">Now playing</p>
          <h1>{song.title}</h1>
          <div className="now-playing-artist artist-credits">
            {getArtistNames(song.artist).map((artist, index) => <span key={artist}><button className="artist-link" onClick={() => onOpenArtist(artist)}>{artist}</button>{index < getArtistNames(song.artist).length - 1 ? ", " : ""}</span>)}
          </div>
          <p className="now-playing-album">{song.album}</p>
          <div className="track-specs">
            <span>{song.format || "AUDIO"}</span>
            <span>{song.sampleRate ? `${(song.sampleRate / 1000).toFixed(1)} kHz` : "--"}</span>
            <span>{song.bitrate ? `${Math.round(song.bitrate / 1000)} kbps` : "--"}</span>
          </div>
        </div>
      </div>

      <div className="now-playing-panels">
        {parsedLyrics.length > 0 ? (
          <section className="lyrics-panel" ref={lyricsContainerRef} style={{ maxHeight: 400, overflowY: 'auto', padding: "30px 24px", position: 'relative' }}>
            {parsedLyrics.map((line, i) => (
              <div 
                key={i} 
                className={`lyric-line ${i === activeLineIndex ? 'active' : ''}`}
                style={{
                  fontSize: i === activeLineIndex ? 24 : 18,
                  fontWeight: i === activeLineIndex ? 700 : 400,
                  color: i === activeLineIndex ? 'var(--amber)' : 'var(--text-dim)',
                  transition: 'all 0.3s ease',
                  margin: '12px 0',
                  minHeight: 20
                }}
              >
                {line.text}
              </div>
            ))}
          </section>
        ) : (
          <section><p className="eyebrow">About this track</p><h2>{song.title}</h2><p>From {song.album}, performed by {song.artist}.</p></section>
        )}
        <section><p className="eyebrow">Credits</p><h2>{song.artist}</h2><p>Local library playback</p></section>
      </div>
    </div>
  );
}

function ArtistProfile({ artist, songs, onPlaySong, onPlayAll, onAddAll }) {
  const albums = [...new Set(songs.map((song) => song.album).filter(Boolean))];
  const featuredSong = songs.find((song) => song.coverUrl) || songs[0];
  const [artistImage, setArtistImage] = useState(null);

  useEffect(() => {
    setArtistImage(null);
    fetchArtistProfile(artist)
      .then((data) => setArtistImage(data?.portraitUrl ? { portraitUrl: data.portraitUrl, backgroundUrl: data.backgroundUrl } : null))
      .catch(() => {});
  }, [artist]);

  const profileImage = artistImage?.backgroundUrl || featuredSong?.coverUrl;
  const portraitImage = artistImage?.portraitUrl || featuredSong?.coverUrl;

  return (
    <div className="artist-page">
      <div className="artist-heading" style={profileImage ? { backgroundImage: `linear-gradient(90deg, rgba(9,11,10,.92) 0%, rgba(9,11,10,.62) 52%, rgba(9,11,10,.78) 100%), url(${profileImage})` } : undefined}>
        <div className="artist-avatar" style={portraitImage ? { backgroundImage: `url(${portraitImage})` } : undefined}>
          {!portraitImage && artist.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="eyebrow">Singer profile</p>
          <h1>{artist}</h1>
          <p>{songs.length} song{songs.length === 1 ? "" : "s"} · {albums.length} album{albums.length === 1 ? "" : "s"} in your library</p>
        </div>
      </div>
      <div className="artist-actions">
        <button className="artist-play-button" onClick={onPlayAll} disabled={songs.length === 0} aria-label={`Play all songs by ${artist}`}>▶ <span>Play all</span></button>
        <button className="artist-secondary-button" onClick={onAddAll} disabled={songs.length === 0}>＋ Add all to queue</button>
      </div>
      <section className="artist-songs">
        <div className="artist-section-heading"><p className="eyebrow">All songs by {artist}</p><span className="mono">{songs.length} tracks</span></div>
        {songs.length === 0 && <p className="queue-empty">No songs by this artist yet.</p>}
        {songs.map((song) => (
          <button key={song.id} onClick={() => onPlaySong(song, songs)} className="artist-song">
            <span className="artist-song-art" style={{ backgroundImage: song.coverUrl ? `url(${song.coverUrl})` : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))" }}><span className="song-hover-play">▶</span></span>
            <span><strong>{song.title}</strong><small>{song.album}</small></span>
            <span className="mono">{formatDuration(song.duration)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
