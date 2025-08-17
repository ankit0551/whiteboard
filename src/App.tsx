import React, { useEffect, useRef, useState } from "react";

// TailwindCSS is assumed to be available in the host app.
// Drop this component anywhere in your React + TypeScript project.
// It provides: pen, eraser, color palette, size slider, clear & export, and
// an auto-growing vertical canvas that extends as you draw near the bottom.

// Utility: clamp number
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Default palette
const PRESET_COLORS = [
  "#111827", // gray-900
  "#ef4444", // red-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f3f4f6", // gray-100
];

type Tool = "pen" | "eraser";

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [size, setSize] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 1600, height: 1400 });
  const [dpr, setDpr] = useState<number>(1);

  // Setup canvas and handle DPR scaling
  useEffect(() => {
    const handleResize = () => {
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
      setDpr(pixelRatio);

      const container = containerRef.current;
      if (!container) return;
      const paddingX = 32; // px padding for nice breathing room
      const width = Math.max(800, container.clientWidth - paddingX);

      // We maintain current height; width responds to container.
      setCanvasSize(prev => ({ width, height: prev.height }));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // (Re)initialize the canvas element when size or DPR changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Preserve current drawing when resizing
    const prev = document.createElement("canvas");
    prev.width = canvas.width;
    prev.height = canvas.height;
    const prevCtx = prev.getContext("2d");
    const oldCtx = canvas.getContext("2d");

    if (prevCtx && oldCtx) {
      prevCtx.drawImage(canvas, 0, 0);
    }

    const { width, height } = canvasSize;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing ops to CSS pixels

    // Restore
    if (prevCtx && ctx && prev.width && prev.height) {
      ctx.drawImage(prev, 0, 0, prev.width / dpr, prev.height / dpr);
    }
  }, [canvasSize.width, canvasSize.height, dpr]);

  const getCtx = () => canvasRef.current?.getContext("2d");

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setLastPoint({ x, y });
  };

  const extendIfNeeded = (y: number) => {
    // If drawing within 200px of bottom, extend by 1000px (auto-growing page)
    const threshold = 200;
    if (canvasSize.height - y < threshold) {
      setCanvasSize(prev => ({ ...prev, height: prev.height + 1000 }));
    }
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = getCtx();
    if (!ctx) return;

    // ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = clamp(size, 1, 64);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPoint) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawLine(lastPoint, { x, y });
    setLastPoint({ x, y });
    extendIfNeeded(y);
  };





  const endDrawUp = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };
  const endDrawCancel = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };
  const endDrawLeave = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };
  const endDrawOut = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  const handleClear = () => {
    const ctx = getCtx();
    const c = canvasRef.current;
    if (ctx && c) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.restore();

    }
  };

  const handleExport = () => {
    const c = canvasRef.current;
    if (!c) return;

    // Create a trimmed export that matches the drawn region height to avoid massive files
    // Detect the lowest non-empty row (very simple scan)
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const w = c.width; // device pixels
    const h = c.height;
    const imgData = ctx.getImageData(0, 0, w, h).data;

    let lastNonEmptyY = 0;
    for (let y = h - 1; y >= 0; y--) {
      let rowHasInk = false;
      const rowStart = y * w * 4;
      for (let x = 0; x < w; x++) {
        const a = imgData[rowStart + x * 4 + 3];
        if (a !== 0) { rowHasInk = true; break; }
      }
      if (rowHasInk) { lastNonEmptyY = y; break; }
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = w;
    exportCanvas.height = Math.max(1, lastNonEmptyY + 10); // 10px padding
    const exportCtx = exportCanvas.getContext("2d")!;
    exportCtx.drawImage(c, 0, 0);

    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const CursorPreview = () => (
    <div className="flex items-center gap-3">
      <div
        className="rounded-full border border-gray-300"
        style={{ width: size, height: size }}
        title="Brush size preview"
      />
      <div className="text-xs text-gray-600">{tool === "eraser" ? "Eraser" : "Pen"} • {size}px</div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-gray-50 text-gray-900">
      <div className="h-full w-full flex">
        {/* Left toolbar */}
        <aside className="w-64 shrink-0 border-r bg-white p-4 flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Tools</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`px-3 py-2 rounded-2xl shadow-sm border text-sm ${tool === "pen" ? "bg-gray-900 text-white" : "bg-white"}`}
              onClick={() => setTool("pen")}
            >
              Pen
            </button>
            <button
              className={`px-3 py-2 rounded-2xl shadow-sm border text-sm ${tool === "eraser" ? "bg-gray-900 text-white" : "bg-white"}`}
              onClick={() => setTool("eraser")}
            >
              Eraser
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Color</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-7 w-7 rounded-full border ${c.toLowerCase() === color.toLowerCase() ? "ring-2 ring-offset-2" : ""}`}
                  style={{ background: c }}
                  onClick={() => { setColor(c); setTool("pen"); }}
                  aria-label={`Choose ${c}`}
                />
              ))}
              <label className="h-7 w-7 rounded-full border overflow-hidden cursor-pointer grid place-items-center">
                <input
                  type="color"
                  className="opacity-0 absolute -z-10"
                  onChange={(e) => { setColor(e.target.value); setTool("pen"); }}
                  value={color}
                  aria-label="Custom color"
                />
                <span className="text-[10px]">+</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Size: {size}px</div>
            <input
              type="range"
              min={1}
              max={64}
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="w-full"
            />
            <CursorPreview />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className="px-3 py-2 rounded-2xl shadow-sm border text-sm" onClick={handleClear}>
              Clear
            </button>
            <button className="px-3 py-2 rounded-2xl shadow-sm border text-sm" onClick={handleExport}>
              Export PNG
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500 leading-relaxed">
            <p>Tip: The board grows automatically when you sketch near the bottom edge.</p>
          </div>
        </aside>

        {/* Drawing surface container */}
        <div ref={containerRef} className="flex-1 overflow-auto">
          <div className="min-h-full w-full mx-auto max-w-none">
            {/* <div className="rounded-2xl border bg-white shadow-sm overflow-hidden"> */}
              <canvas
                ref={canvasRef}
                onPointerDown={startDraw}
                onPointerMove={onPointerMove}
                onPointerUp={endDrawUp}
                onPointerCancel={endDrawCancel}
                onPointerLeave={endDrawLeave}
                onPointerOut={endDrawOut}
                className="block touch-none select-none cursor-crosshair"
              />
            {/* </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
