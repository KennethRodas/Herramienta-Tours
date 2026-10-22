import Image from "next/image";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { cx } from "./cx";

// The tour's photograph as a plate on the page, with its credit on it.
// It shows the place; it is never presented as Wilber's group or trip.

export function PhotoPlate({ photo: slug, className, sizes = "(min-width: 1024px) 560px, 100vw", priority }: { photo: string; className?: string; sizes?: string; priority?: boolean }) {
  const photo = PHOTO_CREDITS[slug];
  if (!photo) return null;
  return (
    <figure className={cx("relative overflow-hidden rounded-ticket bg-sand-300", className)}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      <figcaption className="absolute right-3 top-3 max-w-[calc(100%-1.5rem)] rounded-full bg-sand-50 px-3 py-1 text-small text-cobalt-800">
        Foto:{" "}
        <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-1 underline-offset-2 hover:decoration-2">
          {photo.author}
        </a>
        {" · "}
        {photo.licence}
      </figcaption>
    </figure>
  );
}
