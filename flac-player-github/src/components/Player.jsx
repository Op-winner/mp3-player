import { useEffect, useRef, useState, useCallback } from "react";
import SquigglySeekbar from "./SquigglySeekbar.jsx";
import Visualizer from "./Visualizer.jsx";
import { formatDuration, getArtistNames } from "../api.js";

const REPEAT_MODES = ["off", "all", "one"];

// SVG Icons — no emoji, no encoding issues
const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
);
const IconPause = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
);
const IconPrev = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
);
const IconNext = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6l5.5 3.88V8.12L8.5 12zM16 6h2v12h-2z"/></svg>
);
const IconShuffle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8"/>
    <line x1="4" y1="20" x2="21" y2="3"/>
    <polyline points="21 16 21 21 16 21"/>
    <line x1="15" y1="15" x2="21" y2="21"/>
  </svg>
);
const IconRepeatAll = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
);
const IconRepeatOne = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>
);
const IconQueue = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
);

export default function Player({ queue, currentIndex, setCurrentIndex, onQueueEnd, onOpenNowPlaying, onOpenArtist, onRemoveFromQueue, onClearQueue, onQueueVisibilityChange }) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const graphRef = useRef(null);
  const queueDrawerRef = useRef(null);
  const queueToggleRef = useRef(null);
  const eqPopoverRef = useRef(null);
  const eqToggleRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const savedSettings = JSON.parse(localStorage.getItem("karma-play-settings") || "null");
  const [volume, setVolume] = useState(savedSettings?.volume ?? 0.85);
  const [shuffle, setShuffle] = useState(savedSettings?.shuffle ?? false);
  const [repeatMode, setRepeatMode] = useState(savedSettings?.repeatMode ?? "off");
  const [eq, setEq] = useState(savedSettings?.eq ?? { bass: 0, mid: 0, treble: 0 });
  const [shuffleOrder, setShuffleOrder] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [queueTab, setQueueTab] = useState("queue");
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [dataSaver, setDataSaver] = useState(savedSettings?.dataSaver ?? false);

  const song = queue[currentIndex] || null;
  const upcomingSongs = queue.slice(currentIndex + 1);
  const manualSongs = upcomingSongs.filter((s) => s.queueOrigin === "manual");
  const groupedSongs = upcomingSongs.filter((s) => s.queueOrigin !== "manual");

  useEffect(() => {
    if (!showQueue && !showEq) return undefined;
    const closeOnOutsideClick = (event) => {
      const insideQueue = queueDrawerRef.current?.contains(event.target) || queueToggleRef.current?.contains(event.target);
      const insideEq = eqPopoverRef.current?.contains(event.target) || eqToggleRef.current?.contains(event.target);
      if (!insideQueue && !insideEq) {
        setShowQueue(false);
        setShowEq(false);
        onQueueVisibilityChange?.(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [showQueue, showEq, onQueueVisibilityChange]);

  useEffect(() => {
    if (!song) return;
    setRecentlyPlayed((played) => [song, ...played.filter((item) => item.id !== song.id)].slice(0, 20));
  }, [song?.id]);

  useEffect(() => {
    localStorage.setItem("karma-play-settings", JSON.stringify({ volume, shuffle, repeatMode, eq, dataSaver }));
  }, [volume, shuffle, repeatMode, eq, dataSaver]);

  // Build the Web Audio graph once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || graphRef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);

    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 200;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 0.7;

    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 4000;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(analyser);
    analyser.connect(ctx.destination);

    audioCtxRef.current = ctx;
    graphRef.current = { source, bass, mid, treble, analyser };
  }, []);

  // Apply EQ changes
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.bass.gain.value = eq.bass;
    g.mid.gain.value = eq.mid;
    g.treble.gain.value = eq.treble;
  }, [eq]);

  // Load new track
  useEffect(() => {
    if (!song || !audioRef.current) return;
    const token = localStorage.getItem("karma-play-token");
    const url = new URL(song.streamUrl, window.location.origin);
    if (url.origin === window.location.origin) {
      if (token) url.searchParams.set("token", token);
      if (dataSaver) url.searchParams.set("quality", "128k");
    }
    audioRef.current.src = url.href;
    audioRef.current.load();
    const saved = JSON.parse(localStorage.getItem("karma-play-session") || "null");
    const savedTime = saved?.songId === song.id ? saved.currentTime : 0;
    const restoreTime = () => {
      audioRef.current.currentTime = Math.min(savedTime || 0, audioRef.current.duration || savedTime || 0);
    };
    audioRef.current.addEventListener("loadedmetadata", restoreTime, { once: true });
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
    return () => audioRef.current?.removeEventListener("loadedmetadata", restoreTime);
  }, [song?.id]);

  useEffect(() => {
    if (song) localStorage.setItem("karma-play-session", JSON.stringify({ songId: song.id, currentTime }));
  }, [song?.id, currentTime]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (shuffle) {
      const indices = queue.map((_, i) => i).filter((i) => i !== currentIndex);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffleOrder([currentIndex, ...indices].filter((index) => index >= 0));
    } else {
      setShuffleOrder([]);
    }
  }, [shuffle, queue]);

  const goToRelative = useCallback(
    (dir) => {
      if (queue.length === 0) return;
      if (shuffle && shuffleOrder.length) {
        const posInShuffle = shuffleOrder.indexOf(currentIndex);
        const nextPos = (posInShuffle + dir + shuffleOrder.length) % shuffleOrder.length;
        setCurrentIndex(shuffleOrder[nextPos]);
      } else {
        const next = (currentIndex + dir + queue.length) % queue.length;
        setCurrentIndex(next);
      }
    },
    [queue, currentIndex, shuffle, shuffleOrder, setCurrentIndex]
  );

  const handleEnded = () => {
    if (repeatMode === "one") {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    const atEnd = shuffle
      ? shuffleOrder.indexOf(currentIndex) === shuffleOrder.length - 1
      : currentIndex === queue.length - 1;

    if (atEnd && repeatMode === "off") {
      setIsPlaying(false);
      onQueueEnd && onQueueEnd();
      return;
    }
    goToRelative(1);
  };

  const togglePlay = () => {
    if (!song) return;
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const seek = (t) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const cycleRepeat = () => {
    const idx = REPEAT_MODES.indexOf(repeatMode);
    setRepeatMode(REPEAT_MODES[(idx + 1) % REPEAT_MODES.length]);
  };

  useEffect(() => {
    if ("mediaSession" in navigator && song) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: song.title || "Unknown Title",
        artist: song.artist || "Unknown Artist",
        album: song.album || "Unknown Album",
        artwork: song.coverUrl ? [{ src: song.coverUrl, sizes: "512x512", type: "image/jpeg" }] : [],
      });

      navigator.mediaSession.setActionHandler("play", () => { if (audioRef.current) { audioRef.current.play(); setIsPlaying(true); } });
      navigator.mediaSession.setActionHandler("pause", () => { if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); } });
      navigator.mediaSession.setActionHandler("previoustrack", () => goToRelative(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => goToRelative(1));
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.fastSeek && "fastSeek" in audioRef.current) {
          audioRef.current.fastSeek(details.seekTime);
        } else {
          audioRef.current.currentTime = details.seekTime;
        }
        setCurrentTime(details.seekTime);
      });
    }
  }, [song, goToRelative]);

  useEffect(() => {
    if (song?.coverUrl) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = song.coverUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        document.documentElement.style.setProperty("--dynamic-accent", `rgb(${r}, ${g}, ${b})`);
        document.documentElement.style.setProperty("--dynamic-accent-dim", `rgba(${r}, ${g}, ${b}, 0.2)`);
      };
    } else {
      document.documentElement.style.removeProperty("--dynamic-accent");
      document.documentElement.style.removeProperty("--dynamic-accent-dim");
    }
  }, [song?.coverUrl]);

  return (
    <div className="panel" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {queue[currentIndex + 1] && (
        <link rel="prefetch" as="fetch" href={queue[currentIndex + 1].streamUrl} />
      )}
      <audio
        crossOrigin="anonymous"
        ref={audioRef}
        onTimeUpdate={(e) => {
          setCurrentTime(e.target.currentTime);
          window.dispatchEvent(new CustomEvent("karma-time-update", { detail: e.target.currentTime }));
        }}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onEnded={handleEnded}
      />

      <div style={{ display: "flex", gap: 20 }}>
        {/* Cover + track info */}
        <button className="dashboard-track" onClick={onOpenNowPlaying} aria-label="Open now playing view">
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 4,
              background: song?.coverUrl
                ? `url(${song.coverUrl}) center/cover`
                : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))",
              border: "1px solid var(--hairline)",
              flexShrink: 0,
              boxShadow: isPlaying ? "0 0 22px var(--amber-glow)" : "none",
              transition: "box-shadow 0.4s ease",
            }}
          />
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={song?.title}
            >
              {song ? song.title : "Nothing loaded"}
            </div>
            {song ? (
              <span className="player-artist-link">
                {getArtistNames(song.artist).map((artist, index) => (
                  <span key={artist}>
                    <span
                      role="button"
                      tabIndex="0"
                      onClick={(e) => { e.stopPropagation(); onOpenArtist(artist); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onOpenArtist(artist); } }}
                      title={`Open ${artist} profile`}
                    >
                      {artist}
                    </span>
                    {index < getArtistNames(song.artist).length - 1 ? ", " : ""}
                  </span>
                ))}
                <span> &mdash; {song.album}</span>
              </span>
            ) : (
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Upload some audio files to begin</div>
            )}
            {song && (
              <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2 }}>
                {song.sampleRate ? `${(song.sampleRate / 1000).toFixed(1)}kHz` : "--"} /{" "}
                {song.bitsPerSample ? `${song.bitsPerSample}-bit` : "--"} &middot;{" "}
                {song.bitrate ? `${Math.round(song.bitrate / 1000)}kbps` : "--"} &middot; {song.format || "AUDIO"}
              </div>
            )}
          </div>
        </button>

        {/* Visualizer */}
        <div style={{ width: 260, height: 84, flexShrink: 0 }}>
          <Visualizer analyser={graphRef.current?.analyser} isPlaying={isPlaying} />
        </div>
      </div>

      {/* Seek bar */}
      <div style={{ display: "flex", padding: "0 10px" }}>
        <SquigglySeekbar
          currentTime={currentTime}
          duration={duration}
          onSeek={seek}
          analyser={graphRef.current?.analyser}
          isPlaying={isPlaying}
        />
      </div>

      {/* Transport + EQ + volume */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconButton active={shuffle} onClick={() => setShuffle((s) => !s)} label="Shuffle">
            <IconShuffle />
          </IconButton>
          <IconButton onClick={() => goToRelative(-1)} label="Previous">
            <IconPrev />
          </IconButton>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "1px solid var(--amber-dim)",
              background: "var(--amber)",
              color: "#1a1509",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
          <IconButton onClick={() => goToRelative(1)} label="Next">
            <IconNext />
          </IconButton>
          <IconButton active={repeatMode !== "off"} onClick={cycleRepeat} label={`Repeat: ${repeatMode}`}>
            {repeatMode === "one" ? <IconRepeatOne /> : <IconRepeatAll />}
          </IconButton>
          <span ref={queueToggleRef}>
            <IconButton
              active={showQueue}
              onClick={() => setShowQueue((open) => { onQueueVisibilityChange?.(!open); return !open; })}
              label="Queue"
            >
              <IconQueue />
            </IconButton>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              fontSize: 11,
              color: dataSaver ? "var(--amber)" : "var(--text-faint)",
            }}
          >
            <input type="checkbox" checked={dataSaver} onChange={(e) => setDataSaver(e.target.checked)} style={{ display: "none" }} />
            DATA SAVER
          </label>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>
            VOL
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: 90, accentColor: "var(--amber)" }}
          />
          <span ref={eqToggleRef}>
            <IconButton active={showEq} onClick={() => setShowEq((open) => !open)} label="Equalizer">
              EQ
            </IconButton>
          </span>
        </div>

        {showEq && (
          <div ref={eqPopoverRef} className="eq-popover">
            <EqSlider label="BASS" value={eq.bass} onChange={(v) => setEq((e) => ({ ...e, bass: v }))} />
            <EqSlider label="MID" value={eq.mid} onChange={(v) => setEq((e) => ({ ...e, mid: v }))} />
            <EqSlider label="TREB" value={eq.treble} onChange={(v) => setEq((e) => ({ ...e, treble: v }))} />
          </div>
        )}
      </div>

      {showQueue && (
        <aside ref={queueDrawerRef} className="queue-drawer" aria-label="Playback queue">
          <div className="queue-drawer-topline">
            <div className="queue-tabs">
              <button className={queueTab === "queue" ? "active" : ""} onClick={() => setQueueTab("queue")}>Queue</button>
              <button className={queueTab === "recent" ? "active" : ""} onClick={() => setQueueTab("recent")}>Recently played</button>
            </div>
            <button
              onClick={() => { setShowQueue(false); onQueueVisibilityChange?.(false); }}
              className="queue-close"
              aria-label="Close queue"
            >
              &times;
            </button>
          </div>
          {queueTab === "queue" ? (
            <div className="queue-drawer-content scrollbar-thin">
              {song && <>
                <h2>Now playing</h2>
                <QueueSong song={song} active playing={isPlaying} />
              </>}
              {manualSongs.length > 0 && <>
                <div className="queue-section-heading">
                  <h2>Next in queue</h2>
                  <button onClick={onClearQueue} className="queue-clear">Clear queue</button>
                </div>
                {manualSongs.map((s) => {
                  const index = queue.indexOf(s);
                  return <QueueSong key={`${s.id}-${index}`} song={s} onPlay={() => setCurrentIndex(index)} onRemove={() => onRemoveFromQueue(index)} />;
                })}
              </>}
              {groupedSongs.length > 0 && <>
                <h2>{song ? `Next from: ${groupedSongs[0].queueSourceName || song.album || "your library"}` : "Queue"}</h2>
                {groupedSongs.map((s) => {
                  const index = queue.indexOf(s);
                  return <QueueSong key={`${s.id}-${index}`} song={s} onPlay={() => setCurrentIndex(index)} onRemove={() => onRemoveFromQueue(index)} />;
                })}
              </>}
              {!song && queue.length === 0 && <p className="queue-empty">Your queue is empty.</p>}
              {song && manualSongs.length === 0 && groupedSongs.length === 0 && <p className="queue-empty">Nothing else is queued.</p>}
            </div>
          ) : (
            <div className="queue-drawer-content scrollbar-thin">
              <h2>Recently played</h2>
              {recentlyPlayed.map((recentSong, index) => (
                <QueueSong
                  key={`${recentSong.id}-${index}`}
                  song={recentSong}
                  onPlay={() => {
                    const queueIndex = queue.findIndex((s) => s.id === recentSong.id);
                    if (queueIndex >= 0) setCurrentIndex(queueIndex);
                  }}
                />
              ))}
              {recentlyPlayed.length === 0 && <p className="queue-empty">Nothing played yet.</p>}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function QueueSong({ song, active = false, playing = false, onPlay, onRemove }) {
  return (
    <div className={`queue-drawer-song ${active ? "active" : ""}`}>
      <button onClick={onPlay} className="queue-song">
        <span
          className="queue-art"
          style={{ backgroundImage: song.coverUrl ? `url(${song.coverUrl})` : "linear-gradient(135deg, var(--amber-dim), var(--panel-raised))" }}
        >
          <span className="song-hover-play">
            {active && playing ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </span>
        </span>
        <span className="queue-copy">
          <strong>{song.title}</strong>
          <small>{song.artist}</small>
        </span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="queue-remove"
          aria-label={`Remove ${song.title} from queue`}
          title="Remove from queue"
        >
          &times;
        </button>
      )}
    </div>
  );
}

function IconButton({ children, onClick, active, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 4,
        border: `1px solid ${active ? "var(--amber)" : "var(--hairline)"}`,
        background: active ? "rgba(232,163,61,0.12)" : "transparent",
        color: active ? "var(--amber)" : "var(--text-dim)",
        fontSize: 15,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function EqSlider({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <input
        type="range"
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          writingMode: "vertical-lr",
          direction: "rtl",
          width: 16,
          height: 50,
          accentColor: "var(--green)",
        }}
      />
      <span className="mono" style={{ fontSize: 9, color: "var(--text-faint)" }}>
        {label}
      </span>
    </div>
  );
}
