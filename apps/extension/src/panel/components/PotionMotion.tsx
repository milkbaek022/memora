import { useEffect, useRef } from "react";

const DOT_STEP = 5;

function gaussian(distanceX: number, distanceY: number, radiusX: number, radiusY: number) {
  return Math.exp(-((distanceX * distanceX) / radiusX + (distanceY * distanceY) / radiusY));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculatePointerPush({
  dotX,
  dotY,
  pointerX,
  pointerY,
  velocityX,
  velocityY,
  active
}: {
  dotX: number;
  dotY: number;
  pointerX: number;
  pointerY: number;
  velocityX: number;
  velocityY: number;
  active: number;
}) {
  const strength = gaussian(dotX - pointerX, dotY - pointerY, 3600, 2400) * active;
  return {
    x: velocityX * strength,
    y: velocityY * strength
  };
}

export function PotionMotion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({
    x: 0.5,
    y: 0.55,
    targetX: 0.5,
    targetY: 0.55,
    velocityX: 0,
    velocityY: 0,
    targetVelocityX: 0,
    targetVelocityY: 0,
    active: 0,
    targetActive: 0
  });

  function updatePointer(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const nextY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    const pointer = pointerRef.current;
    pointer.targetVelocityX = nextX - pointer.targetX;
    pointer.targetVelocityY = nextY - pointer.targetY;
    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.targetActive = 1;
  }

  function releasePointer() {
    pointerRef.current.targetActive = 0;
    pointerRef.current.targetVelocityX = 0;
    pointerRef.current.targetVelocityY = 0;
  }

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const drawingCanvas = canvas;

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = drawingCanvas.getContext("2d");
    } catch {
      return;
    }
    if (!context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const bounds = drawingCanvas.getBoundingClientRect();
      width = bounds.width || 380;
      height = bounds.height || 220;
      drawingCanvas.width = Math.round(width * pixelRatio);
      drawingCanvas.height = Math.round(height * pixelRatio);
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function draw(time: number) {
      if (!context) return;
      const t = time / 1000;
      context.clearRect(0, 0, width, height);

      const pointer = pointerRef.current;
      pointer.x += (pointer.targetX - pointer.x) * 0.16;
      pointer.y += (pointer.targetY - pointer.y) * 0.16;
      pointer.active += (pointer.targetActive - pointer.active) * 0.12;
      pointer.velocityX += (pointer.targetVelocityX - pointer.velocityX) * 0.32;
      pointer.velocityY += (pointer.targetVelocityY - pointer.velocityY) * 0.32;
      pointer.targetVelocityX *= 0.82;
      pointer.targetVelocityY *= 0.82;

      const pointerX = pointer.x * width;
      const pointerY = pointer.y * height;
      const followX = (pointer.x - 0.5) * width * 0.1 * pointer.active;
      const followY = (pointer.y - 0.5) * height * 0.08 * pointer.active;
      const pushVelocityX = pointer.velocityX * width * 2.4;
      const pushVelocityY = pointer.velocityY * height * 2.4;
      const bloomX = width * (0.5 + Math.sin(t * 0.42) * 0.04) + followX;
      const bloomY = height * (0.6 + Math.cos(t * 0.36) * 0.04) + followY;

      for (let y = 42; y < height - 10; y += DOT_STEP) {
        for (let x = 6; x < width - 6; x += DOT_STEP) {
          const centerX = x - bloomX;
          const centerY = y - bloomY;
          const angle = Math.atan2(centerY, centerX);
          const radius = Math.hypot(centerX, centerY);
          const swirl = Math.sin(angle * 5 + radius * 0.045 - t * 2.1);
          const open = 1 + Math.sin(t * 0.9 + radius * 0.02) * 0.12;

          const core =
            gaussian(centerX + swirl * 16, centerY, 8800 * open, 3100 * open) * 1.35;
          const leftBubble = gaussian(
            x - width * 0.26,
            y - height * (0.52 + Math.sin(t * 0.7) * 0.08),
            3300,
            2100
          );
          const rightBubble = gaussian(
            x - width * 0.72,
            y - height * (0.38 + Math.cos(t * 0.52) * 0.08),
            3600,
            2300
          );
          const lowerMist = gaussian(x - width * 0.5, y - height * 0.84, 14000, 1200);
          const pointerDistanceX = x - pointerX;
          const pointerDistanceY = y - pointerY;
          const hoverField =
            gaussian(pointerDistanceX, pointerDistanceY, 2600, 1900) * pointer.active;
          const field = Math.max(
            0,
            core +
              leftBubble * 0.75 +
              rightBubble * 0.85 +
              lowerMist * 0.35 +
              hoverField * 0.24
          );

          if (field < 0.18) continue;

          const sparkle = Math.sin(x * 0.22 + y * 0.18 + t * 3.4) * 0.18;
          const depth = Math.min(1, field + sparkle);
          const alpha = Math.min(0.9, Math.max(0.12, depth * 0.72));
          const dotSize = Math.max(1, Math.min(2.8, 0.9 + depth * 2.1));
          const shade = depth > 0.72 ? "38 140 128" : depth > 0.43 ? "79 190 172" : "205 255 106";
          const push = calculatePointerPush({
            dotX: x,
            dotY: y,
            pointerX,
            pointerY,
            velocityX: pushVelocityX,
            velocityY: pushVelocityY,
            active: pointer.active
          });
          const drawX = x + push.x;
          const drawY = y + push.y;

          context.fillStyle = `rgb(${shade} / ${alpha})`;
          context.fillRect(drawX, drawY, dotSize, dotSize);
        }
      }

      for (let i = 0; i < 9; i += 1) {
        const bubbleX =
          width * (0.18 + i * 0.08 + Math.sin(t * 0.8 + i) * 0.025) +
          (pointer.x - 0.5) * width * 0.08 * pointer.active;
        const bubbleY = height - ((t * 34 + i * 24) % (height * 0.76));
        const radius = 2 + (i % 3) * 1.25;
        context.beginPath();
        context.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
        context.strokeStyle = `rgb(211 255 98 / ${0.28 + (i % 3) * 0.08})`;
        context.lineWidth = 1;
        context.stroke();
      }

      animationFrame = window.requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(() => resize());
    observer.observe(drawingCanvas);
    resize();
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      className="potion-motion"
      aria-label="记忆药水动态"
      onPointerEnter={updatePointer}
      onPointerMove={updatePointer}
      onPointerLeave={releasePointer}
    >
      <canvas ref={canvasRef} className="potion-canvas" />
      <div className="potion-header">
        <span>Memora</span>
        <code>memory_potion</code>
      </div>
    </div>
  );
}
