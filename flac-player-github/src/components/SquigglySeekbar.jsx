import React, { useRef, useEffect, useState } from "react";
import { formatDuration } from "../api.js";

export default function SquigglySeekbar({ currentTime, duration, onSeek, analyser, isPlaying }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const percentage = duration > 0 ? (currentTime / duration) : 0;

  useEffect(() => {
    if (!svgRef.current) return;
    
    let animationId;
    let phase = 0;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const draw = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const width = svg.clientWidth;
      const height = svg.clientHeight;
      const centerY = height / 2;
      const progressWidth = width * percentage;

      // Base amplitude
      let amplitude = 0;
      let frequency = 0.05;

      if (isPlaying && analyser) {
        analyser.getByteFrequencyData(dataArray);
        // Average the bass frequencies (first few bins)
        let bassSum = 0;
        const bassBins = 5;
        for (let i = 0; i < bassBins; i++) {
          bassSum += dataArray[i];
        }
        const avgBass = bassSum / bassBins;
        // Map bass (0-255) to amplitude (0 - 6)
        amplitude = (avgBass / 255) * 6;
        phase -= 0.15; // Move the wave
      } else {
        amplitude = 0;
      }

      // Generate the path string
      let path = `M 0 ${centerY}`;
      
      // Draw squiggly line up to progress thumb
      for (let x = 0; x <= progressWidth; x += 2) {
        // Fade out amplitude near the thumb so it meets the thumb cleanly
        const distFromThumb = progressWidth - x;
        const fade = Math.min(distFromThumb / 20, 1);
        const y = centerY + Math.sin(x * frequency + phase) * amplitude * fade;
        path += ` L ${x} ${y}`;
      }

      // Draw straight line for the rest
      path += ` L ${progressWidth} ${centerY} L ${width} ${centerY}`;

      let pathEl = svg.querySelector('path.squiggly-path');
      if (!pathEl) {
        pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.classList.add('squiggly-path');
        pathEl.setAttribute("stroke", "var(--amber)");
        pathEl.setAttribute("stroke-width", "3");
        pathEl.setAttribute("stroke-linecap", "round");
        pathEl.setAttribute("fill", "none");
        svg.appendChild(pathEl);
      }
      pathEl.setAttribute("d", path);

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [percentage, isPlaying, analyser]);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    handlePointerMove(e);
  };

  const handlePointerMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const newTime = (x / rect.width) * duration;
    onSeek(newTime);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    } else {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, duration]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
      <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", width: 38 }}>
        {formatDuration(currentTime)}
      </span>
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        style={{ 
          flex: 1, 
          height: 30, 
          position: "relative", 
          cursor: "pointer", 
          display: "flex", 
          alignItems: "center" 
        }}
      >
        <svg 
          ref={svgRef} 
          style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} 
        />
        <div style={{
          position: "absolute",
          top: "50%",
          left: `${percentage * 100}%`,
          transform: "translate(-50%, -50%)",
          width: 12,
          height: 12,
          backgroundColor: "#fff",
          borderRadius: "50%",
          boxShadow: "0 0 4px rgba(0,0,0,0.5)",
          pointerEvents: "none"
        }} />
        {/* Faded track line for the unplayed portion */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: `${percentage * 100}%`,
          right: 0,
          height: 3,
          transform: "translateY(-50%)",
          backgroundColor: "rgba(255,255,255,0.15)",
          pointerEvents: "none",
          borderRadius: 2
        }} />
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", width: 38, textAlign: "right" }}>
        {formatDuration(duration)}
      </span>
    </div>
  );
}
