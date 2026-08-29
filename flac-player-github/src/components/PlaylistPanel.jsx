import { useEffect, useState } from "react";
import { createPlaylist, deletePlaylist, pinPlaylist } from "../api.js";

export default function PlaylistPanel({ playlists, refreshPlaylists, selectedPlaylistId, onSelectPlaylist, onAddPlaylistToQueue, compact = false, likedCount = 0 }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    document.addEventListener("pointerdown", closeContextMenu);
    return () => document.removeEventListener("pointerdown", closeContextMenu);
  }, []);

  const openContextMenu = (event, playlist) => {
    event.preventDefault();
    setContextMenu({ playlist, x: Math.min(event.clientX, window.innerWidth - 250), y: Math.min(event.clientY, window.innerHeight - 260) });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createPlaylist(name.trim());
    setName("");
    setCreating(false);
    await refreshPlaylists();
  };

  return (
    <div className={`panel playlist-panel ${compact ? "playlist-panel-compact" : ""}`} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 18 }}>Playlists</h2>
      </div>

      <button
        onClick={() => onSelectPlaylist(null)}
        style={{
          textAlign: "left",
          background: selectedPlaylistId === null ? "rgba(232,163,61,0.1)" : "none",
          border: "none",
          color: selectedPlaylistId === null ? "var(--amber)" : "var(--text)",
          padding: "8px 10px",
          borderRadius: 4,
          fontSize: 13.5,
        }}
      >
        ▤ All songs
      </button>
      <button
        onClick={() => onSelectPlaylist("liked")}
        className="liked-playlist-button"
        style={{ textAlign: "left", background: selectedPlaylistId === "liked" ? "rgba(232,163,61,0.1)" : "none", border: "none", color: selectedPlaylistId === "liked" ? "var(--amber)" : "var(--text)", padding: "8px 10px", borderRadius: 4, fontSize: 13.5 }}
      >
        <span className="liked-heart">♥</span><span className="playlist-name">Liked Songs</span><span className="mono" style={{ color: "var(--text-faint)", fontSize: 10.5, marginLeft: 6 }}>{likedCount}</span>
      </button>

      <div className="scrollbar-thin" style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {playlists.map((pl) => (
          <div
            key={pl.id}
            onContextMenu={(event) => openContextMenu(event, pl)}
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
              background: selectedPlaylistId === pl.id ? "rgba(232,163,61,0.1)" : "transparent",
            }}
          >
            <button
              onClick={() => onSelectPlaylist(pl.id)}
              style={{
                flex: 1,
                textAlign: "left",
                background: "none",
                border: "none",
                color: selectedPlaylistId === pl.id ? "var(--amber)" : "var(--text)",
                padding: "8px 10px",
                fontSize: 13.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span className="playlist-tile">♪</span><span className="playlist-name">{pl.name}</span>
              <span className="mono" style={{ color: "var(--text-faint)", fontSize: 10.5, marginLeft: 6 }}>
                {pl.songCount}
              </span>
            </button>
            <button
              onClick={async () => {
                await pinPlaylist(pl.id, !pl.pinned);
                await refreshPlaylists();
              }}
              style={{ background: "none", border: "none", color: pl.pinned ? "var(--amber)" : "var(--text-faint)", fontSize: 13, padding: "0 4px" }}
              aria-label={`${pl.pinned ? "Unpin" : "Pin"} ${pl.name}`}
              title={pl.pinned ? "Unpin playlist" : "Pin playlist"}
            >
              {pl.pinned ? "★" : "☆"}
            </button>
            <button
              onClick={async () => {
                await deletePlaylist(pl.id);
                if (selectedPlaylistId === pl.id) onSelectPlaylist(null);
                await refreshPlaylists();
              }}
              style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 13, padding: "0 8px" }}
              aria-label={`Delete ${pl.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {creating && (
        <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            style={{ flex: 1, minWidth: 0, background: "var(--panel-raised)", border: "1px solid var(--hairline)", borderRadius: 4, color: "var(--text)", padding: "6px 8px", fontSize: 13 }}
          />
          <button type="submit" style={{ background: "var(--amber)", border: "none", borderRadius: 4, padding: "0 10px", color: "#1a1509", fontSize: 13 }}>
            Add
          </button>
        </form>
      )}
      <button
        onClick={() => setCreating((c) => !c)}
        className="add-playlist-button"
        aria-label="New playlist"
        title="New playlist"
      >
        + <span>Create playlist</span>
      </button>
      {contextMenu && (
        <div className="playlist-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button className="context-menu-item" onClick={() => { onSelectPlaylist(contextMenu.playlist.id); setContextMenu(null); }}>▤ <span>Open playlist</span></button>
          <button className="context-menu-item" onClick={() => { onAddPlaylistToQueue?.(contextMenu.playlist.id); setContextMenu(null); }}>☷ <span>Add to queue</span></button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={async () => { await pinPlaylist(contextMenu.playlist.id, !contextMenu.playlist.pinned); await refreshPlaylists(); setContextMenu(null); }}>{contextMenu.playlist.pinned ? "📌" : "☆"} <span>{contextMenu.playlist.pinned ? "Unpin playlist" : "Pin playlist"}</span></button>
          <button className="context-menu-item" onClick={() => { setCreating(true); setContextMenu(null); }}>＋ <span>Create playlist</span></button>
          <button className="context-menu-item context-menu-danger" onClick={async () => { await deletePlaylist(contextMenu.playlist.id); if (selectedPlaylistId === contextMenu.playlist.id) onSelectPlaylist(null); await refreshPlaylists(); setContextMenu(null); }}>⊖ <span>Delete playlist</span></button>
        </div>
      )}
    </div>
  );
}
