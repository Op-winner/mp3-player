import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../frontend/src/components/Player.jsx");
let text = fs.readFileSync(p, "utf-8");

// Revert syntax errors
text = text.replace(/aria-label/g, "aria-label");
text = text.replace(/className="dashboard-track"/g, 'className="dashboard-track"');
text = text.replace(/className="queue-drawer"/g, 'className="queue-drawer"');
text = text.replace(/className="queue-drawer-topline"/g, 'className="queue-drawer-topline"');
text = text.replace(/className="queue-tabs"/g, 'className="queue-tabs"');
text = text.replace(/className="queue-close"/g, 'className="queue-close"');
text = text.replace(/className="queue-drawer-content/g, 'className="queue-drawer-content');
text = text.replace(/className="queue-section-heading"/g, 'className="queue-section-heading"');
text = text.replace(/className="queue-clear"/g, 'className="queue-clear"');
text = text.replace(/className="queue-empty"/g, 'className="queue-empty"');
text = text.replace(/className={`queue-drawer-song/g, 'className={`queue-drawer-song');
text = text.replace(/className="queue-song"/g, 'className="queue-song"');
text = text.replace(/className="queue-art"/g, 'className="queue-art"');
text = text.replace(/className="song-hover-play"/g, 'className="song-hover-play"');
text = text.replace(/className="queue-copy"/g, 'className="queue-copy"');
text = text.replace(/className="queue-remove"/g, 'className="queue-remove"');
text = text.replace(/className="eq-popover"/g, 'className="eq-popover"');
text = text.replace(/scrollbar-thin/g, 'scrollbar-thin');
text = text.replace(/vertical-lr/g, 'vertical-lr');

text = text.replace(/var\(--/g, 'var(--');
text = text.replace(/ goToRelative\(-1\)/g, ' goToRelative(-1)');
text = text.replace(/min={-12}/g, 'min={-12}');
text = text.replace(/onQueueVisibilityChange\?\./g, 'onQueueVisibilityChange?.');
text = text.replace(/\?/g, '?'); // Most standard ternaries

// Revert icons
text = text.replace(/Y"\?/g, '🔀'); // Shuffle
text = text.replace(/ǽ\?/g, '⏮');   // Previous (it was ǽ? which is ǽ? after ternary fix)
text = text.replace(/-\/g, '▶');  // Play (was -)
text = text.replace(/>ǽ </g, '>⏭<'); // Next
text = text.replace(/Y"'/g, '🔂'); // Repeat one
text = text.replace(/~/g, '☰');  // Queue
text = text.replace(/ǟ\?"/g, '×'); // Close queue
text = text.replace(/\?"/g, '—'); // Em dash
text = text.replace(/Â·/g, '·'); // Middle dot

// Let's do a few explicit icon fixes based on the component structure:
text = text.replace(/{isPlaying \? "\?" : "▶"}/g, '{isPlaying ? "⏸" : "▶"}');
text = text.replace(/{active && playing \? "ǽ\?" : "▶"}/g, '{active && playing ? "⏸" : "▶"}');

fs.writeFileSync(p, text, "utf8");
console.log("Repaired syntax");
