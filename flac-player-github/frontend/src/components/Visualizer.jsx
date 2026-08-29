import { useEffect, useRef } from "react";

// Renders audio frequency data as segmented LED-style bars, like a hi-fi rack VU meter.
export default function Visualizer({ analyser, isPlaying }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const BAR_COUNT = 28;
    const SEGMENTS = 12;
    let data = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
    const idleLevels = new Array(BAR_COUNT).fill(0);

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      let levels;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data);
        levels = new Array(BAR_COUNT).fill(0).map((_, i) => {
          // sample a log-ish spread across the frequency bins for a more musical spread
          const start = Math.floor((i / BAR_COUNT) ** 1.5 * data.length * 0.6);
          const end = Math.max(start + 1, Math.floor(((i + 1) / BAR_COUNT) ** 1.5 * data.length * 0.6));
          let sum = 0;
          for (let j = start; j < end; j++) sum += data[j] || 0;
          const avg = sum / Math.max(1, end - start);
          return avg / 255;
        });
      } else {
        // idle: gentle decay to zero
        levels = idleLevels.map((v) => Math.max(0, v - 0.02));
      }
      for (let i = 0; i < BAR_COUNT; i++) idleLevels[i] = levels[i];

      const gap = 3;
      const barWidth = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const segGap = 2;
      const segHeight = (h - segGap * (SEGMENTS - 1)) / SEGMENTS;

      for (let i = 0; i < BAR_COUNT; i++) {
        const lit = Math.round(levels[i] * SEGMENTS);
        const x = i * (barWidth + gap);
        for (let s = 0; s < SEGMENTS; s++) {
          const y = h - (s + 1) * (segHeight + segGap) + segGap;
          const on = s < lit;
          let color = "#2b2820"; // off segment
          if (on) {
            const frac = s / SEGMENTS;
            color = frac > 0.82 ? "#c9634f" : frac > 0.6 ? "#e8a33d" : "#6fa287";
          }
          ctx.fillStyle = color;
          ctx.fillRect(x, y, barWidth, segHeight);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, isPlaying]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
