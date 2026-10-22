import { Crew } from "@/components/site/home/crew";
import { Faq } from "@/components/site/home/faq";
import { Hero } from "@/components/site/home/hero";
import { Itinerary } from "@/components/site/home/itinerary";
import { RoutePlate } from "@/components/site/home/route-plate";
import { TourMenu } from "@/components/site/home/tour-menu";
import { VisitCard } from "@/components/site/home/visit-card";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TourMenu />
      <RoutePlate />
      <Itinerary />
      <Faq />
      <Crew />
      <VisitCard />
    </>
  );
}
