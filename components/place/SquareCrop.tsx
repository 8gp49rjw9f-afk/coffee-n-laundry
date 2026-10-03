"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";

/*
 * A square, in the browser, with no new dependency: the frame is a
 * div, the image beneath it is moved by pointer events, and the crop
 * is drawn once into a canvas at the end.
 *
 * Two fingers pinch to zoom, one finger drags to move. Pointers are
 * tracked by id, because a phone delivers both at once and a single
 * `drag.current` slot would let the second finger hijack the first.
 *
 * The layout is sized with dvh, not vh: on iOS Safari the browser's
 * own toolbar is not part of 100vh, so a full-height panel puts its
 * controls underneath the toolbar where they cannot be tapped. That
 * is what hid the confirm button on a phone.
 */

const OUTPUT = 1400; // the square side, in pixels
const MAX_ZOOM = 4;

interface Point {
  x: number;
  y: number;
}

export function SquareCrop({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [url, setUrl] = useState<string>("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [frameSide, setFrameSide] = useState(0);

  /* scale=1 means "the frame is exactly filled, nothing more". */
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  /* Every finger down, by pointer id. */
  const pointers = useRef(new Map<number, Point>());

  /* What the gesture looked like when it started. */
  const gesture = useRef<{
    distance: number;
    zoom: number;
    center: Point;
    offset: Point;
  } | null>(null);

  const drag = useRef<{ pointerId: number; start: Point; offset: Point } | null>(
    null
  );

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);

    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  /*
   * The frame is measured rather than assumed — it is a square sized
   * by CSS — and it is measured again whenever it changes, because a
   * rotate or a keyboard opening resizes it.
   */
  useEffect(() => {
    const node = frameRef.current;

    if (!node) return;

    const measure = () => setFrameSide(node.clientWidth);

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const baseScale = natural.width
    ? frameSide / Math.min(natural.width, natural.height)
    : 1;

  const drawSide = baseScale * zoom;

  /* Keeps the image covering the frame: no white edges, ever. */
  function clamp(next: Point, atZoom = zoom): Point {
    const side = baseScale * atZoom;
    const limitX = Math.max(0, (natural.width * side - frameSide) / 2);
    const limitY = Math.max(0, (natural.height * side - frameSide) / 2);

    return {
      x: Math.min(limitX, Math.max(-limitX, next.x)),
      y: Math.min(limitY, Math.max(-limitY, next.y)),
    };
  }

  useEffect(() => {
    if (natural.width) setOffset((current) => clamp(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, zoom, frameSide]);

  function points(): Point[] {
    return [...pointers.current.values()];
  }

  function midpoint(list: Point[]): Point {
    return {
      x: list.reduce((sum, p) => sum + p.x, 0) / list.length,
      y: list.reduce((sum, p) => sum + p.y, 0) / list.length,
    };
  }

  function spread(list: Point[]): number {
    if (list.length < 2) return 0;

    return Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    /* The frame swallows the gesture so the page behind cannot scroll
       or the browser cannot start its own zoom. */
    event.currentTarget.setPointerCapture(event.pointerId);

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const list = points();

    if (list.length === 1) {
      drag.current = {
        pointerId: event.pointerId,
        start: list[0],
        offset,
      };

      gesture.current = null;

      return;
    }

    if (list.length === 2) {
      drag.current = null;

      gesture.current = {
        distance: spread(list),
        zoom,
        center: midpoint(list),
        offset,
      };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const list = points();

    /* ---------- two fingers: pinch ---------- */

    if (list.length >= 2 && gesture.current) {
      const start = gesture.current;

      const ratio = start.distance > 0 ? spread(list) / start.distance : 1;

      const nextZoom = Math.min(MAX_ZOOM, Math.max(1, start.zoom * ratio));

      /* Zooming around the fingers, not the centre: the spot you
         pinched stays where your fingers are. */
      const centreNow = midpoint(list);

      const scaleChange = (nextZoom * baseScale) / (start.zoom * baseScale);

      const anchor = {
        x: start.center.x - start.offset.x,
        y: start.center.y - start.offset.y,
      };

      const next = {
        x: centreNow.x - anchor.x * scaleChange,
        y: centreNow.y - anchor.y * scaleChange,
      };

      setZoom(nextZoom);
      setOffset(clamp(next, nextZoom));

      return;
    }

    /* ---------- one finger: drag ---------- */

    const active = drag.current;

    if (!active || active.pointerId !== event.pointerId) return;

    setOffset(
      clamp({
        x: active.offset.x + (event.clientX - active.start.x),
        y: active.offset.y + (event.clientY - active.start.y),
      })
    );
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);

    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
    }

    /* Lifting one finger of a pinch leaves the other one dragging:
       without this the image freezes until both are lifted. */
    const list = points();

    if (list.length === 1) {
      gesture.current = null;

      drag.current = {
        pointerId: [...pointers.current.keys()][0],
        start: list[0],
        offset,
      };

      return;
    }

    if (list.length === 0) {
      gesture.current = null;
    }
  }

  /* Double-tap cycles between the frame filled and a closer look. */
  function onDoubleClick() {
    setZoom((current) => (current >= 2 ? 1 : 2));
  }

  /* The crop: the frame's square, mapped back into image pixels. */
  async function apply() {
    const image = imageRef.current;

    if (!image || frameSide === 0 || natural.width === 0) return;

    setBusy(true);

    const side = baseScale * zoom;

    /* Top-left of the frame, in image coordinates. */
    const left = (natural.width * side) / 2 - frameSide / 2 - offset.x;
    const top = (natural.height * side) / 2 - frameSide / 2 - offset.y;

    const sourceSide = frameSide / side;
    const sourceX = left / side;
    const sourceY = top / side;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;

    const context = canvas.getContext("2d");

    if (!context) {
      setBusy(false);
      return;
    }

    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSide,
      sourceSide,
      0,
      0,
      OUTPUT,
      OUTPUT
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob) {
      setBusy(false);
      return;
    }

    onDone(
      new File([blob], file.name.replace(/\.[^.]+$/, "") + "-square.jpg", {
        type: "image/jpeg",
      })
    );
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-[1300] flex h-[100dvh] flex-col bg-black"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl px-3 font-semibold text-white/90 hover:bg-white/10"
        >
          Cancel
        </button>

        <span className="text-sm font-semibold">Square crop</span>

        <span className="w-16" />
      </div>

      {/* The frame is given a definite size rather than "all the space
          left over": flex-1 on iOS can grow past the viewport and push
          the controls off the bottom of the screen. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onDoubleClick={onDoubleClick}
          className="relative aspect-square max-h-full w-full max-w-md touch-none select-none overflow-hidden rounded-2xl bg-white/10"
        >
          {url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={imageRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: natural.width ? natural.width * drawSide : undefined,
                height: natural.height ? natural.height * drawSide : undefined,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                touchAction: "none",
              }}
            />
          )}

          {/* Thirds, to place the subject without measuring. */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-3 px-4 pb-4 pt-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-white/80">
            Zoom
          </span>

          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-white"
          />
        </label>

        <p className="text-center text-xs text-white/60">
          Drag to move, pinch to zoom, or double-tap.
        </p>

        <Button onClick={apply} disabled={busy} className="w-full">
          {busy ? "Preparing…" : "Use this square"}
        </Button>
      </div>
    </div>
  );
}

export default SquareCrop;
