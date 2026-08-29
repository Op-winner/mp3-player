import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../frontend/src/components/Player.jsx");
let text = fs.readFileSync(p, "utf-8");

text = text.replace(/×/g, '-'); // Revert all my terrible hypen replacements!
text = text.replace(/-/g, '▶');
text = text.replace(/\?/g, '⏸');
text = text.replace(/\?/g, '⏮'); // previous might have been this
text = text.replace(//g, ''); // Just strip all other garbage characters

fs.writeFileSync(p, text, "utf8");
console.log("Restored hyphens.");
