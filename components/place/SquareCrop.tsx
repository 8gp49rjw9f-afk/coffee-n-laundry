"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";

/*
 * A square, in the browser, with no new dependency: the frame is a
 * div, the image beneath it is moved by pointer events, and the
 * crop is drawn once into a canvas at the end.
 *
 * The output is square and nothing else. A photo of a machine or a
 * price list reads fine as a square; it reads badly as a 4:3 with
 * the interesting part off-frame on a phone.
 */

const OUTPUT = 1400; // the square side, in pixels

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

  /* scale=1 means "the frame is exactly filled, nothing more". */
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);

    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  /* The frame is measured, not assumed: it is a square sized by CSS,
     and the image has to be scaled against its real pixel side. */
  const frameSide = frameRef.current?.clientWidth ?? 0;

  const baseScale = natural.width
    ? frameSide / Math.min(natural.width, natural.height)
    : 1;

  const drawSide = baseScale * zoom;

  /* Keeps the image covering the frame: no white edges, ever. */
  function clamp(next: { x: number; y: number }, atZoom = zoom) {
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

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;

    setOffset(
      clamp({
        x: event.clientX - drag.current.x,
        y: event.clientY - drag.current.y,
      })
    );
  }

  function onPointerUp() {
    drag.current = null;
  }

  /* The crop: the frame's square, mapped back into image pixels. */
  async function apply() {
    const image = imageRef.current;

    if (!image || frameSide === 0) return;

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

    if (!context) return;

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

    if (!blob) return;

    onDone(
      new File([blob], file.name.replace(/\.[^.]+$/, "") + "-square.jpg", {
        type: "image/jpeg",
      })
    );
  }

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
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

      <div className="flex flex-1 items-center justify-center px-4">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative aspect-square w-full max-w-md touch-none overflow-hidden rounded-2xl bg-white/10"
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
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: natural.width ? natural.width * drawSide : undefined,
                height: natural.height ? natural.height * drawSide : undefined,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
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

      <div className="space-y-3 px-4 pb-6 pt-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-white/80">
            Zoom
          </span>

          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-white"
          />
        </label>

        <p className="text-center text-xs text-white/60">
          Drag to move, pinch is not needed — the slider zooms.
        </p>

        <Button onClick={apply} className="w-full">
          Use this square
        </Button>
      </div>
    </div>
  );
}

export default SquareCrop;
