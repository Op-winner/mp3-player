import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../frontend/src/components/Player.jsx");
let text = fs.readFileSync(p, "utf-8");

// Fix syntax and CSS hyphens
text = text.replace(/-/g, '-');
// Fix ternary operators
text = text.replace(/\?/g, '?');

// Fix specific known icons manually
text = text.replace(/{isPlaying \? "\?" : "▶"}/g, '{isPlaying ? "⏸" : "▶"}');
text = text.replace(/{active && playing \? "ǽ\?" : "▶"}/g, '{active && playing ? "⏸" : "▶"}');
text = text.replace(/>ǽ </g, '>⏭<');
text = text.replace(/>ǽ\?</g, '>⏮<');
text = text.replace(/>ǟ\?"</g, '>×<');
text = text.replace(/{repeatMode === "one" \? "Y"'" : "Y"\?"}/g, '{repeatMode === "one" ? "🔂" : "🔁"}');
text = text.replace(/>Y"\?</g, '>🔀<');
text = text.replace(/>~</g, '>☰<');

// There are a few stray symbols, let's fix them:
text = text.replace(/{song \? <span/g, '{song ? <span');
text = text.replace(/<span> \?" {song\.album}<\/span>/g, '<span> — {song.album}</span>');

fs.writeFileSync(p, text, "utf8");
console.log("Player.jsx repaired!");
