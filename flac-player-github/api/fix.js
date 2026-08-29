import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../frontend/src/components/Player.jsx");
const text = fs.readFileSync(p, "utf-8");

// When it got corrupted, I actually had already run the manual replace that fixed "⏸" and "▶" just now.
// So let's restore from git... wait I don't have git.
// Let's just manually replace all the known garbled strings with their real icons.

let fixed = text;
fixed = fixed.replace(/â€”/g, '—');
fixed = fixed.replace(/Â·/g, '·');
fixed = fixed.replace(/â¤¨/g, '🔀');
fixed = fixed.replace(/â\x90®/g, '⏮');
fixed = fixed.replace(/â–¶/g, '▶');
fixed = fixed.replace(/â ¸/g, '⏸');
fixed = fixed.replace(/â\x90/g, '⏭');
fixed = fixed.replace(/ðŸ”‚/g, '🔂');
fixed = fixed.replace(/ðŸ” /g, '🔁');
fixed = fixed.replace(/â˜/g, '☰');
fixed = fixed.replace(/-/g, '×'); // close button
fixed = fixed.replace(/\?/g, '⏮'); 

fs.writeFileSync(p, fixed, "utf8");
console.log("Fixed manually!");
