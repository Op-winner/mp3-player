const BASE = import.meta.env.VITE_API_URL || "/api";

export function getArtistNames(artist) {
  return [...new Map(String(artist || "Unknown Artist")
    .split(/\s*,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => [name.toLowerCase(), name])).values()];
}

export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem("karma-play-token");
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("karma-play-token");
      localStorage.removeItem("karma-play-user");
      window.dispatchEvent(new Event("auth-expired"));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API error");
  }
  return res.json();
}

export async function fetchSongs() { return apiCall("/songs"); }
export async function fetchArtistProfile(artist) { return apiCall(`/artists/${encodeURIComponent(artist)}`); }
export async function fetchDiscovery() { return apiCall("/discovery"); }
export async function downloadSongAutonomous(data) { return apiCall("/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); }

export async function uploadSongs(files, onProgress) {
  const form = new FormData();
  for (const f of files) form.append("files", f);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/songs/upload`);
    const token = localStorage.getItem("karma-play-token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem("karma-play-token");
        window.dispatchEvent(new Event("auth-expired"));
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error("Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(form);
  });
}

export async function updateSongMetadata(id, data) {
  return apiCall(`/songs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export async function likeSong(id, liked) {
  return apiCall(`/songs/${id}/like`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liked }) });
}
export const toggleLike = likeSong;

export async function uploadSongPoster(id, file) {
  const form = new FormData();
  form.append("cover", file);
  const token = localStorage.getItem("karma-play-token");
  
  const res = await fetch(`${BASE}/songs/${id}/cover`, { 
    method: "POST", 
    body: form,
    headers: token ? { "Authorization": `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error("Cover update failed");
  return res.json();
}
export const replaceCover = uploadSongPoster;

export async function deleteSong(id) { return apiCall(`/songs/${id}`, { method: "DELETE" }); }

export async function fetchPlaylists() { return apiCall("/playlists"); }
export async function fetchPlaylist(id) { return apiCall(`/playlists/${id}`); }
export async function createPlaylist(name) { return apiCall("/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); }
export async function updatePlaylist(id, name) { return apiCall(`/playlists/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); }
export async function deletePlaylist(id) { return apiCall(`/playlists/${id}`, { method: "DELETE" }); }
export async function togglePinPlaylist(id, pinned) { return apiCall(`/playlists/${id}/pin`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) }); }
export async function addSongToPlaylist(playlistId, songId) { return apiCall(`/playlists/${playlistId}/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ songId }) }); }
export async function removeSongFromPlaylist(playlistId, songId) { return apiCall(`/playlists/${playlistId}/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ songId }) }); }
export async function reorderPlaylist(playlistId, songs) { return apiCall(`/playlists/${playlistId}/reorder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ songs }) }); }

export async function authLogin(username, password) { return apiCall("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); }
export async function authRegister(username, password) { return apiCall("/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); }

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const pinPlaylist = togglePinPlaylist;

