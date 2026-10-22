"use client";

import Image from "next/image";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import type { Tour } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// The fixed frame of "index with preview": every tour's photograph is stacked
// in one frame and the one under the pointer fades in (240ms) while settling
// from a slight scale. The caption carries the place and the photo credit.

export function PreviewFrame({
  tours,
  activeId,
  className,
  boxClassName = "aspect-[4/5]",
  captionClassName,
}: {
  tours: Tour[];
  activeId: string | null;
  className?: string;
  boxClassName?: string;
  captionClassName?: string;
}) {
  const active = tours.find((t) => t.id === activeId) ?? tours[0];
  if (!active) return null;
  const credit = PHOTO_CREDITS[active.photo];

  return (
    <figure className={cn("w-full", className)}>
      <div className={cn("relative w-full overflow-hidden bg-cobalt-900", boxClassName)}>
        {tours.map((t) => {
          const photo = PHOTO_CREDITS[t.photo];
          if (!photo) return null;
          const on = t.id === active.id;
          return (
            <Image
              key={t.id}
              src={photo.src}
              alt={on ? photo.alt : ""}
              aria-hidden={on ? undefined : true}
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
              style={{
                opacity: on ? 1 : 0,
                transform: on ? "scale(1)" : "scale(1.045)",
                transition: "opacity 240ms ease, transform 1400ms var(--ease-out)",
              }}
            />
          );
        })}
      </div>
      {credit && (
        <figcaption className={cn("mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-small", captionClassName)}>
          <span className="font-semibold">{active.name}</span>
          <span>
            Foto: {credit.author}, {credit.licence}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
