import { useState } from "react";
import { authLogin, authRegister } from "../api.js";

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = isRegister ? authRegister : authLogin;
      const res = await fn(username, password);
      localStorage.setItem("karma-play-token", res.token);
      localStorage.setItem("karma-play-user", JSON.stringify(res.user));
      onLogin(res.user);
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360, background: "var(--surface)", padding: 32, borderRadius: 12, display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, textAlign: "center" }}>
          {isRegister ? "Create Account" : "Welcome Back"}
        </h1>
        {error && <div style={{ color: "var(--red)", fontSize: 14, textAlign: "center" }}>{error}</div>}
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          className="search-bar" 
          required 
          autoFocus 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="search-bar" 
          required 
        />
        <button type="submit" disabled={loading} style={{ background: "var(--amber)", color: "#111", border: "none", padding: "12px", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: "pointer", marginTop: 8 }}>
          {loading ? "Please wait..." : (isRegister ? "Sign Up" : "Log In")}
        </button>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-faint)", marginTop: 8 }}>
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <span style={{ color: "var(--amber)", cursor: "pointer" }} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? "Log In" : "Sign Up"}
          </span>
        </div>
      </form>
    </div>
  );
}
