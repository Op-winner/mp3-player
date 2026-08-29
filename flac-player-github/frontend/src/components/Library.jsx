import { useState, useEffect, useRef } from "react";
import { deleteSong, uploadSongPoster, formatDuration, formatFileSize, getArtistNames, likeSong, updateSongMetadata, updatePlaylist, fetchDiscovery, downloadSongAutonomous } from "../api.js";

export default function Library({ songs, collectionName = "All songs", refreshSongs, onPlaySong, currentSongId, isPlaying, playlists, onAddToPlaylist, onAddToQueue, onPlayNext, onOpenArtist, onToggleLike, onSelectPlaylist, onPlayAlbum, playlistId, allSongs, onUpdatePlaylist, onRemoveFromPlaylist, onReorderPlaylist }) {
  const posterInputRef = useRef(null);
  const [error, setError] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [filter, setFilter] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", artist: "", album: "", genre: "", year: "", lyrics: "" });
  
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [playlistNameEdit, setPlaylistNameEdit] = useState("");
  const [showAddMusic, setShowAddMusic] = useState(false);
  const [addMusicSearch, setAddMusicSearch] = useState("");
  const [customOrder, setCustomOrder] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  const [discoverySongs, setDiscoverySongs] = useState([]);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [discoverySearch, setDiscoverySearch] = useState("");

  useEffect(() => {
    if (filter === "Discovery" && discoverySongs.length === 0) {
      setIsLoadingDiscovery(true);
      fetchDiscovery().then(setDiscoverySongs).catch(console.error).finally(() => setIsLoadingDiscovery(false));
    }
  }, [filter]);

  const isCustomPlaylist = playlistId && playlistId !== "liked";

  const startEditing = (song) => {
    setEditingSong(song);
    setEditForm({
      title: song.title || "",
      artist: song.artist || "",
      album: song.album || "",
      genre: song.genre || "",
      year: song.year || "",
      lyrics: song.lyrics || ""
    });
    setMenuFor(null);
    setContextMenu(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSong) return;
    try {
      await updateSongMetadata(editingSong.id, {
        title: editForm.title || null,
        artist: editForm.artist || null,
        album: editForm.album || null,
        genre: editForm.genre || null,
        year: editForm.year ? parseInt(editForm.year, 10) : null,
        lyrics: editForm.lyrics || null
      });
      await refreshSongs();
      setEditingSong(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const selectPoster = (songId) => {
    setMenuFor(null);
    posterInputRef.current.dataset.songId = songId;
    posterInputRef.current.click();
  };

  const handlePlaylistNameSave = async () => {
    if (!playlistNameEdit.trim()) return;
    try {
      await updatePlaylist(playlistId, playlistNameEdit);
      await onUpdatePlaylist();
      setIsEditingPlaylist(false);
    } catch (e) { setError(e.message); }
  };

  const movePlaylistSong = async (index, direction) => {
    if (!onReorderPlaylist) return;
    const newSongs = [...songs];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSongs.length) return;
    
    const temp = newSongs[index];
    newSongs[index] = newSongs[targetIndex];
    newSongs[targetIndex] = temp;
    
    await onReorderPlaylist(playlistId, newSongs.map(s => s.id));
  };

  const handleDragStart = (e, index) => {
    if (!customOrder || !isCustomPlaylist) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e, index) => {
    if (draggedIndex === null || !customOrder || !isCustomPlaylist) return;
    setDragOverIndex(index);
  };

  const handleDragOver = (e) => {
    if (draggedIndex === null || !customOrder || !isCustomPlaylist) return;
    e.preventDefault();
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || !customOrder || !isCustomPlaylist) return;
    
    if (draggedIndex !== targetIndex) {
      const newSongs = [...songs];
      const [draggedSong] = newSongs.splice(draggedIndex, 1);
      newSongs.splice(targetIndex, 0, draggedSong);
      
      try {
        await onReorderPlaylist(playlistId, newSongs.map(s => s.id));
      } catch (err) { setError(err.message); }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    document.addEventListener("pointerdown", closeContextMenu);
    return () => document.removeEventListener("pointerdown", closeContextMenu);
  }, []);

  const openContextMenu = (event, song) => {
    event.preventDefault();
    setMenuFor(null);
    setPlaylistSearch("");
    setShowPlaylistMenu(false);
    setContextMenu({ song, x: Math.min(event.clientX, window.innerWidth - 300), y: Math.min(event.clientY, window.innerHeight - 430) });
  };

  const playlistCovers = isCustomPlaylist 
    ? Array.from(new Set(songs.map(s => s.coverUrl).filter(Boolean)))
    : [];

  return (
    <div className="library-view">
      <input ref={posterInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (event) => {
        const file = event.target.files?.[0];
        const songId = event.target.dataset.songId;
        if (!file || !songId) return;
        try {
          await uploadSongPoster(songId, file);
          await refreshSongs();
        } catch (e) {
          setError(e.message);
        }
        event.target.value = "";
      }} />
      <div className="library-heading">
        <div className="library-heading-top" style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          {isCustomPlaylist && (
            <div style={{ width: 192, height: 192, flexShrink: 0, borderRadius: 4, overflow: "hidden", background: "var(--panel-raised)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", display: "grid", gridTemplateColumns: playlistCovers.length >= 4 ? "1fr 1fr" : "1fr", gridTemplateRows: playlistCovers.length >= 4 ? "1fr 1fr" : "1fr" }}>
              {playlistCovers.length >= 4 ? (
                playlistCovers.slice(0, 4).map((c, i) => <div key={i} style={{ background: `url(${c}) center/cover` }} />)
              ) : (
                <div style={{ background: playlistCovers[0] ? `url(${playlistCovers[0]}) center/cover` : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!playlistCovers[0] && <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>}
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>{isCustomPlaylist ? "Private Playlist" : "Your Library"}</p>
            {isEditingPlaylist ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input 
                  autoFocus
                  className="text-input" 
                  value={playlistNameEdit} 
                  onChange={(e) => setPlaylistNameEdit(e.target.value)}
                  style={{ fontSize: 48, fontWeight: "bold", padding: "4px 8px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4, width: "100%", maxWidth: 400 }}
                />
                <button onClick={handlePlaylistNameSave} style={{ background: "var(--amber)", color: "#111", border: "none", padding: "8px 16px", borderRadius: 20, fontWeight: "bold", cursor: "pointer" }}>Save</button>
                <button onClick={() => setIsEditingPlaylist(false)} style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--hairline)", padding: "8px 16px", borderRadius: 20, cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: isCustomPlaylist ? 56 : 32, margin: "0 0 8px 0", lineHeight: 1.2 }}>
                {collectionName}
                {isCustomPlaylist && (
                  <button onClick={() => { setPlaylistNameEdit(collectionName); setIsEditingPlaylist(true); }} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: "50%" }} title="Edit details" onMouseEnter={e => e.currentTarget.style.background="var(--panel-raised)"} onMouseLeave={e => e.currentTarget.style.background="none"}>✎</button>
                )}
              </h1>
            )}
            {isCustomPlaylist && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--amber-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", marginRight: 4, fontSize: 12 }}>K</span>
                <span style={{ color: "var(--text)", fontWeight: "bold" }}>Karma Patel</span>
                <span>•</span>
                <span>{songs.length} song{songs.length === 1 ? "" : "s"}</span>
                <span>•</span>
                <span>{formatDuration(songs.reduce((acc, s) => acc + (s.duration || 0), 0))}</span>
              </div>
            )}
          </div>
          {!isCustomPlaylist && <button className="create-button" onClick={() => document.querySelector(".add-music")?.click()}>＋ <strong>Create</strong></button>}
        </div>
        
        {isCustomPlaylist && (
          <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
            <button className="create-button" style={{ background: "rgba(255,255,255,0.1)", border: "none" }} onClick={() => setShowAddMusic(!showAddMusic)}>＋ <strong>Add</strong></button>
            <button className="create-button" style={{ background: "rgba(255,255,255,0.1)", border: "none" }} onClick={() => { setPlaylistNameEdit(collectionName); setIsEditingPlaylist(true); }}>✎ <strong>Name & details</strong></button>
            <div style={{ flex: 1 }} />
            <button className="create-button" style={{ background: customOrder ? "var(--amber)" : "rgba(255,255,255,0.1)", color: customOrder ? "#111" : "var(--text)", border: "none" }} onClick={() => setCustomOrder(!customOrder)}><strong>Custom order</strong> ☷</button>
          </div>
        )}

        {!isCustomPlaylist && (
          <div className="library-filters">
            {["All", "Playlists", "Albums", "Artists", "Discovery"].map((item) => {
              const isActive = item === "All" ? filter === null : filter === item;
              return (
                <button 
                  key={item} 
                  className={isActive ? "active" : (item === "Discovery" ? "discovery-badge" : "")} 
                  onClick={() => setFilter(item === "All" ? null : item)}
                  style={item === "Discovery" && !isActive ? { background: "var(--amber)", color: "#111" } : undefined}
                >
                  {item === "Discovery" ? "✨ Discovery" : item}
                </button>
              );
            })}
          </div>
        )}
        <div className="library-toolbar">
          <button className="library-search" aria-label="Search library">⌕</button>
          {!isCustomPlaylist && <span>Recents&nbsp; ☷</span>}
        </div>
      </div>

      {error && <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>}
      
      {showAddMusic && (
        <div className="panel" style={{ margin: "0 0 16px 0", padding: 16, borderRadius: 8, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Add to playlist</h3>
            <button onClick={() => setShowAddMusic(false)} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <input 
            autoFocus
            className="text-input" 
            placeholder="Search for songs..." 
            value={addMusicSearch} 
            onChange={(e) => setAddMusicSearch(e.target.value)}
            style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4 }}
          />
          {addMusicSearch && (
            <div className="scrollbar-thin" style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {allSongs
                .filter(s => !songs.find(ps => ps.id === s.id)) // not in playlist
                .filter(s => s.title?.toLowerCase().includes(addMusicSearch.toLowerCase()) || s.artist?.toLowerCase().includes(addMusicSearch.toLowerCase()))
                .slice(0, 10)
                .map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", background: "var(--panel)", borderRadius: 4 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 3, background: s.coverUrl ? `url(${s.coverUrl}) center/cover` : "var(--panel-raised)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.artist}</div>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await onAddToPlaylist(playlistId, s.id);
                        } catch (e) { setError(e.message); }
                      }}
                      style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--text-faint)", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
                    >
                      Add
                    </button>
                  </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="scrollbar-thin" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {filter === "Playlists" && (
          <>
            {playlists.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "24px 4px", textAlign: "center" }}>No playlists yet.</div>}
            {playlists.map(pl => (
              <div
                key={pl.id}
                className="library-song-row"
                onClick={() => onSelectPlaylist?.(pl.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 6px", borderRadius: 4, cursor: "pointer", borderBottom: "1px solid var(--hairline)" }}
              >
                <div className="library-song-art" style={{ width: 48, height: 48, borderRadius: 4, flexShrink: 0, background: "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid var(--hairline)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{pl.name}</div>
                  <div className="artist-credits">Playlist • {pl.songs?.length || 0} songs</div>
                </div>
              </div>
            ))}
          </>
        )}
        
        {filter === "Artists" && (
          <>
            {Array.from(new Set(songs.flatMap(s => getArtistNames(s.artist)).filter(a => a && a.toLowerCase() !== "unknown artist" && a.toLowerCase() !== "unknown"))).sort().map(artist => (
              <div
                key={artist}
                className="library-song-row"
                onClick={() => onOpenArtist?.(artist)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 6px", borderRadius: 4, cursor: "pointer", borderBottom: "1px solid var(--hairline)" }}
              >
                <div className="library-song-art" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid var(--hairline)", color: "var(--text)", overflow: "hidden" }}>
                  <img src={`/api/artists/${encodeURIComponent(artist)}/image`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.target.style.display = 'none'} />
                  <span style={{ position: "absolute", zIndex: -1 }}>{artist.charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{artist}</div>
                  <div className="artist-credits">Artist</div>
                </div>
              </div>
            ))}
          </>
        )}
        
        {filter === "Albums" && (
          <>
            {Array.from(new Set(songs.map(s => s.album).filter(a => a && a.toLowerCase() !== "unknown album" && a.toLowerCase() !== "unknown"))).sort().map(album => {
              const albumSong = songs.find(s => s.album === album);
              return (
                <div
                  key={album}
                  className="library-song-row"
                  onClick={() => onPlayAlbum?.(album)}
                  title={`Play album: ${album}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 6px", borderRadius: 4, cursor: "pointer", borderBottom: "1px solid var(--hairline)" }}
                >
                  <div className="library-song-art" style={{ width: 48, height: 48, borderRadius: 4, flexShrink: 0, background: albumSong?.coverUrl ? `url(${albumSong.coverUrl}) center/cover` : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))", border: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!albumSong?.coverUrl && <span style={{fontSize: 20, color: "var(--text-faint)"}}>💿</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{album}</div>
                    <div className="artist-credits">Album • {albumSong?.artist}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {filter === "Discovery" && (
          <>
            <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "8px 4px 16px", lineHeight: "1.5" }}>
              <strong style={{ color: "var(--amber)", display: "block", marginBottom: 4 }}>Global Search & New Releases</strong>
              Search the internet for any released song to preview it, or browse the latest trending tracks below!
            </div>
            
            <div style={{ display: "flex", gap: 8, padding: "0 4px 16px" }}>
              <input 
                type="text" 
                className="text-input" 
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8 }}
                placeholder="Search any song or artist globally..." 
                value={discoverySearch}
                onChange={(e) => setDiscoverySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && discoverySearch.trim()) {
                    setIsLoadingDiscovery(true);
                    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(discoverySearch)}&entity=song&limit=15`)
                      .then(r => r.json())
                      .then(data => {
                        const tracks = data.results.map(track => ({
                          id: track.trackId.toString(),
                          title: track.trackName,
                          artist: track.artistName,
                          album: track.collectionName,
                          coverUrl: track.artworkUrl100?.replace('100x100bb', '500x500bb'),
                          streamUrl: track.previewUrl,
                          duration: track.trackTimeMillis ? Math.floor(track.trackTimeMillis / 1000) : null,
                          created_at: track.releaseDate,
                          isDiscovery: true
                        }));
                        setDiscoverySongs(tracks);
                      })
                      .catch(console.error)
                      .finally(() => setIsLoadingDiscovery(false));
                  }
                }}
              />
              <button 
                className="primary-button" 
                style={{ padding: "0 16px", borderRadius: 8 }}
                onClick={() => {
                  if (!discoverySearch.trim()) return;
                  setIsLoadingDiscovery(true);
                  fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(discoverySearch)}&entity=song&limit=15`)
                    .then(r => r.json())
                    .then(data => {
                      const tracks = data.results.map(track => ({
                        id: track.trackId.toString(),
                        title: track.trackName,
                        artist: track.artistName,
                        album: track.collectionName,
                        coverUrl: track.artworkUrl100?.replace('100x100bb', '500x500bb'),
                        streamUrl: track.previewUrl,
                        duration: track.trackTimeMillis ? Math.floor(track.trackTimeMillis / 1000) : null,
                        created_at: track.releaseDate,
                        isDiscovery: true
                      }));
                      setDiscoverySongs(tracks);
                    })
                    .catch(console.error)
                    .finally(() => setIsLoadingDiscovery(false));
                }}
              >
                Search
              </button>
            </div>

            {isLoadingDiscovery ? (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-faint)" }}>Fetching new releases...</div>
            ) : discoverySongs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-faint)" }}>No new releases found.</div>
            ) : (
              discoverySongs.map((song) => (
                <div
                  key={song.id}
                  className="library-song-row"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 6px", borderRadius: 4, borderBottom: "1px solid var(--hairline)" }}
                >
                  <div className="library-song-art" onClick={() => onPlaySong(song)} style={{ width: 48, height: 48, borderRadius: 4, flexShrink: 0, cursor: "pointer", background: song.coverUrl ? `url(${song.coverUrl}) center/cover` : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))", border: "1px solid var(--hairline)" }}>
                    <div className="hover-play" style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", opacity: currentSongId === song.id ? 1 : 0, transition: "opacity 0.2s" }}>
                      <span style={{ fontSize: 24, color: "#fff" }}>{currentSongId === song.id && isPlaying ? "⏸" : "▶"}</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => onPlaySong(song)}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{song.title}</div>
                    <div className="artist-credits" style={{ color: "var(--amber-dim)" }}>New Release • {song.artist}</div>
                  </div>
                  <button 
                    className="icon-button"
                    title="Download autonomously to your library"
                    disabled={song.downloading}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setDiscoverySongs(prev => prev.map(s => s.id === song.id ? { ...s, downloading: true } : s));
                      try {
                        await downloadSongAutonomous({
                          title: song.title,
                          artist: song.artist,
                          album: song.album,
                          coverUrl: song.coverUrl,
                          releaseDate: song.created_at
                        });
                        refreshSongs(); // Reload library
                        setDiscoverySongs(prev => prev.map(s => s.id === song.id ? { ...s, downloading: false, downloaded: true } : s));
                      } catch (err) {
                        console.error(err);
                        alert("Download failed");
                        setDiscoverySongs(prev => prev.map(s => s.id === song.id ? { ...s, downloading: false } : s));
                      }
                    }}
                    style={{ background: song.downloaded ? "var(--green)" : "rgba(255,255,255,0.1)", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", opacity: song.downloading ? 0.5 : 1 }}
                  >
                    {song.downloading ? "⌛" : song.downloaded ? "✓" : "⬇"}
                  </button>
                </div>
              ))
            )}
          </>
        )}
        {!filter && (
          <>
            {songs.length === 0 && (
              <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "24px 4px", textAlign: "center" }}>
                No songs yet. Use the + button to add music.
              </div>
            )}
            {songs.map((song, index) => {
          const active = song.id === currentSongId;
          const isDragTarget = dragOverIndex === index;
          return (
            <div
              key={song.id}
              className="library-song-row"
              onClick={() => onPlaySong(song)}
              onContextMenu={(event) => openContextMenu(event, song)}
              draggable={isCustomPlaylist && customOrder}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 6px",
                borderRadius: 4,
                cursor: isCustomPlaylist && customOrder ? "grab" : "pointer",
                background: active ? "rgba(232,163,61,0.08)" : (isDragTarget ? "rgba(255,255,255,0.1)" : "transparent"),
                borderBottom: isDragTarget ? "2px solid var(--amber)" : "1px solid var(--hairline)",
                borderTop: isDragTarget && index === 0 ? "2px solid var(--amber)" : "none",
                opacity: draggedIndex === index ? 0.5 : 1,
              }}
            >
              <div className="library-song-art"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 3,
                  flexShrink: 0,
                  background: song.coverUrl ? `url(${song.coverUrl}) center/cover` : `linear-gradient(135deg, var(--amber-dim), var(--panel-raised))`,
                  border: "1px solid var(--hairline)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: active && isPlaying ? "var(--amber)" : "var(--text-faint)",
                }}
              >
                <button className="song-hover-play" onClick={(event) => { event.stopPropagation(); onPlaySong(song); }} aria-label={`Play ${song.title}`} title={`Play ${song.title}`}>
                  ▶
                </button>
                {active && isPlaying ? "♫" : ""}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    color: active ? "var(--amber)" : "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {song.title}
                </div>
                <div className="artist-credits">
                  {getArtistNames(song.artist).map((artist, index) => <span key={artist}>
                    <button onClick={(event) => { event.stopPropagation(); onOpenArtist(artist); }} className="artist-credit-link">{artist}</button>{index < getArtistNames(song.artist).length - 1 ? ", " : ""}
                  </span>)}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                {song.bitsPerSample || "--"}/{song.sampleRate ? (song.sampleRate / 1000).toFixed(0) : "--"}
              </span>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", width: 40, textAlign: "right" }}>
                {formatDuration(song.duration)}
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", width: 60, textAlign: "right" }}>
                {formatFileSize(song.fileSize)}
              </span>

              {isCustomPlaylist && customOrder && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, cursor: "grab", color: "var(--text-faint)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </div>
              )}

              <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                {isCustomPlaylist && (
                  <button
                    onClick={async () => {
                      try { await onRemoveFromPlaylist(playlistId, song.id); } catch (e) { setError(e.message); }
                    }}
                    style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 16, padding: "0 6px", cursor: "pointer" }}
                    title="Remove from playlist"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="song-more-button"
                  onClick={() => setMenuFor(menuFor === song.id ? null : song.id)}
                  style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 16, padding: "0 6px" }}
                  aria-label="More options"
                >
                  ⋯
                </button>
                {menuFor === song.id && (
                  <div
                    className="panel"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 24,
                      zIndex: 10,
                      minWidth: 170,
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => {
                          onAddToPlaylist(pl.id, song.id);
                          setMenuFor(null);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text)",
                          textAlign: "left",
                          fontSize: 12.5,
                          padding: "6px 8px",
                          borderRadius: 3,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-raised)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        Add to “{pl.name}”
                      </button>
                    ))}
                    {playlists.length === 0 && (
                      <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "6px 8px" }}>No playlists yet</div>
                    )}
                    <button onClick={async () => { await onToggleLike(song); setMenuFor(null); }} style={{ background: "none", border: "none", color: song.liked ? "var(--amber)" : "var(--text)", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 3 }}>
                      {song.liked ? "Unlike song" : "Like song"}
                    </button>
                    <button onClick={() => { onAddToQueue(song); setMenuFor(null); }} style={{ background: "none", border: "none", color: "var(--text)", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 3 }}>
                      Add in queue
                    </button>
                    <button onClick={() => { onPlayNext(song); setMenuFor(null); }} style={{ background: "none", border: "none", color: "var(--amber)", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 3 }}>
                      Play next
                    </button>
                    <button
                      onClick={() => startEditing(song)}
                      style={{ background: "none", border: "none", color: "var(--text)", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 3 }}
                    >
                      Edit Info
                    </button>
                    <button
                      onClick={() => selectPoster(song.id)}
                      style={{ background: "none", border: "none", color: "var(--text)", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 3 }}
                    >
                      Set poster image
                    </button>
                    <div style={{ borderTop: "1px solid var(--hairline)", margin: "4px 0" }} />
                    <button
                      onClick={async () => {
                        await deleteSong(song.id);
                        await refreshSongs();
                        setMenuFor(null);
                      }}
                      style={{ background: "none", border: "none", color: "var(--red)", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 3 }}
                    >
                      Delete song
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </>
        )}
      </div>
      {contextMenu && (
        <div className="song-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button className="context-menu-item context-menu-create" onClick={() => setShowPlaylistMenu((open) => !open)}>＋ <span>Add to playlist</span><b>›</b></button>
          {showPlaylistMenu && <div className="playlist-context-submenu">
            <div className="context-menu-search"><span>⌕</span><input autoFocus value={playlistSearch} onChange={(event) => setPlaylistSearch(event.target.value)} placeholder="Find a playlist" /></div>
            <button className="context-menu-item context-menu-create" onClick={() => { document.querySelector(".add-playlist-button")?.click(); setContextMenu(null); }}>＋ <span>New playlist</span></button>
            <div className="context-menu-divider" />
            {playlists.filter((playlist) => playlist.name.toLowerCase().includes(playlistSearch.toLowerCase())).map((playlist) => (
              <button key={playlist.id} className="context-menu-item" onClick={() => { onAddToPlaylist(playlist.id, contextMenu.song.id); setContextMenu(null); }}>＋ <span>{playlist.name}</span></button>
            ))}
            {playlists.length === 0 && <div className="context-menu-empty">No playlists yet</div>}
          </div>}
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={() => { onToggleLike(contextMenu.song); setContextMenu(null); }}>
            {contextMenu.song.liked ? "♥" : "♡"} <span>{contextMenu.song.liked ? "Remove from Liked Songs" : "Save to your Liked Songs"}</span>
          </button>
          <button className="context-menu-item" onClick={() => { onAddToQueue(contextMenu.song); setContextMenu(null); }}>☷ <span>Add to queue</span></button>
          <button className="context-menu-item" onClick={() => { onOpenArtist(getArtistNames(contextMenu.song.artist)[0]); setContextMenu(null); }}>♧ <span>Go to artist</span><b>›</b></button>
          <button className="context-menu-item" onClick={() => { setContextMenu(null); onPlaySong(contextMenu.song); }}>◉ <span>Go to album</span><b>›</b></button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={() => startEditing(contextMenu.song)}>✎ <span>Edit Info</span></button>
        </div>
      )}

      {editingSong && (
        <div className="modal-overlay" onClick={() => setEditingSong(null)}>
          <div className="modal-content panel" onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: "90%", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2>Edit Info</h2>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
                Title
                <input autoFocus className="text-input" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
                Artist
                <input className="text-input" value={editForm.artist} onChange={(e) => setEditForm({...editForm, artist: e.target.value})} style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
                Album
                <input className="text-input" value={editForm.album} onChange={(e) => setEditForm({...editForm, album: e.target.value})} style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4 }} />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
                  Genre
                  <input className="text-input" value={editForm.genre} onChange={(e) => setEditForm({...editForm, genre: e.target.value})} style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4 }} />
                </label>
                <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
                  Year
                  <input type="number" className="text-input" value={editForm.year} onChange={(e) => setEditForm({...editForm, year: e.target.value})} style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4 }} />
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
                Synchronized Lyrics (LRC)
                <textarea className="text-input scrollbar-thin" rows={4} value={editForm.lyrics} onChange={(e) => setEditForm({...editForm, lyrics: e.target.value})} placeholder="[00:15.20] Lyric line here..." style={{ padding: "8px 12px", background: "var(--panel-raised)", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 4, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12 }} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setEditingSong(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--hairline)", color: "var(--text)", borderRadius: 20, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 16px", background: "var(--amber)", border: "none", color: "#111", borderRadius: 20, cursor: "pointer", fontWeight: "bold" }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
