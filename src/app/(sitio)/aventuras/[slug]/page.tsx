import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BUSINESS, DIFFICULTY_LABEL, TOURS, meetingPointById, tourBySlug } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { formatDuration, formatUsd } from "@/lib/domain/format";
import { TourDepartures } from "@/components/booking/tour-departures";
import { ItinerarySection, MeetingSection, RouteSection, TourHeader } from "@/components/booking/tour-sections";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOURS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tour = tourBySlug(slug);
  if (!tour) return { title: "Aventura no encontrada" };
  const photo = PHOTO_CREDITS[tour.photo];
  const description = `${tour.summary} ${formatDuration(tour.durationHours)} · ${DIFFICULTY_LABEL[tour.difficulty]} · ${formatUsd(tour.priceUsd)} por persona.`;
  return {
    title: tour.name,
    description,
    alternates: { canonical: `/aventuras/${tour.slug}` },
    openGraph: {
      title: tour.name,
      description,
      images: photo ? [{ url: photo.src, width: photo.width, height: photo.height, alt: photo.alt }] : undefined,
    },
  };
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const tour = tourBySlug(slug);
  if (!tour) notFound();
  const photo = PHOTO_CREDITS[tour.photo];
  const point = meetingPointById(tour.meetingPointId);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.name,
    description: tour.description,
    touristType: DIFFICULTY_LABEL[tour.difficulty],
    provider: { "@type": "Organization", name: BUSINESS.legalName },
    offers: { "@type": "Offer", price: tour.priceUsd, priceCurrency: "USD" },
  };

  return (
    <div className="flex flex-col gap-(--section-gap) pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TourHeader tour={tour} photo={photo} />
      <TourDepartures tour={{ id: tour.id, name: tour.name, slug: tour.slug }} />
      <RouteSection tour={tour} />
      <ItinerarySection tour={tour} />
      {point ? <MeetingSection tour={tour} point={point} /> : null}
    </div>
  );
}
