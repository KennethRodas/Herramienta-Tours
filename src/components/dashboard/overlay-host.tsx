"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Drawer } from "@/components/motion/drawer";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { useDash, type Overlay } from "./context";
import { useIsDesktop } from "./hooks";
import { IconBtn } from "./ui";
import { DepartureView } from "./departure-view";
import { BookingView } from "./booking-view";
import { NewDepartureForm } from "./departure-form";
import { ManualBookingForm } from "./booking-form";
import { WeatherAlertForm } from "./weather-alert";

const TITLE: Record<Overlay["kind"], string> = {
  departure: "Salida",
  booking: "Reserva",
  "new-departure": "Nueva salida",
  "new-booking": "Reserva manual",
  weather: "Aviso de clima",
};

const keyOf = (o: Overlay, depth: number) =>
  `${depth}:${o.kind}:${"id" in o ? o.id : "departureId" in o ? (o.departureId ?? "") : ""}`;

/** The one sheet (phone) or drawer (desktop) every detail and form opens in. */
export function OverlayHost() {
  const { stack, close } = useDash();
  const desktop = useIsDesktop();
  // Keep the last content on screen while the surface slides away.
  const [shown, setShown] = useState<Overlay[]>(stack);
  if (stack.length > 0 && stack !== shown) setShown(stack);
  const open = stack.length > 0;
  const top = shown[shown.length - 1];
  const label = top ? TITLE[top.kind] : "Detalle";

  const body = top ? <StackView stack={shown} /> : null;

  if (desktop) {
    return (
      <Drawer
        open={open}
        onOpenChange={(o) => !o && close()}
        side="right"
        ariaLabel={label}
        className="w-[min(560px,94vw)] border-0 bg-paper text-paper-ink shadow-[0_0_0_1px_var(--border)]"
        backdropClassName="bg-cobalt-950/25 backdrop-blur-[2px]"
      >
        <div className="h-full overflow-y-auto overscroll-contain px-6 pb-12">{body}</div>
      </Drawer>
    );
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      snapPoints={[0.94]}
      title={label}
      className="max-h-[calc(100dvh-10px)] rounded-t-[22px] border-0 bg-paper text-paper-ink [&_h2[id$='-title']]:sr-only"
    >
      <div className="pb-[calc(env(safe-area-inset-bottom)+12px)]">{body}</div>
    </BottomSheet>
  );
}

function StackView({ stack }: { stack: Overlay[] }) {
  const reduce = useReducedMotion();
  const depth = stack.length;
  // Direction of travel: deeper slides in from the right, back from the left.
  const [prevDepth, setPrevDepth] = useState(depth);
  const [dir, setDir] = useState(1);
  if (depth !== prevDepth) {
    setPrevDepth(depth);
    setDir(depth > prevDepth ? 1 : -1);
  }
  const top = stack[depth - 1];
  const key = keyOf(top, depth);
  const ref = useRef<HTMLDivElement>(null);
  // A new view starts at its top, not where the previous one was scrolled.
  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>(".overflow-y-auto");
    scroller?.scrollTo({ top: 0 });
  }, [key]);
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 28 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.24, ease: EASE_OUT } },
    exit: (d: number) =>
      reduce
        ? { opacity: 0, transition: { duration: 0.12 } }
        : { opacity: 0, x: d * -20, transition: { duration: 0.14, ease: EASE_OUT } },
  };
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <motion.div ref={ref} key={key} custom={dir} variants={variants} initial="enter" animate="center" exit="exit">
        <View overlay={top} />
      </motion.div>
    </AnimatePresence>
  );
}

function View({ overlay }: { overlay: Overlay }) {
  switch (overlay.kind) {
    case "departure":
      return <DepartureView id={overlay.id} />;
    case "booking":
      return <BookingView id={overlay.id} />;
    case "new-departure":
      return <NewDepartureForm tourId={overlay.tourId} dateKey={overlay.dateKey} />;
    case "new-booking":
      return <ManualBookingForm departureId={overlay.departureId} />;
    case "weather":
      return <WeatherAlertForm departureId={overlay.departureId} />;
  }
}

/** Sticky top row of every sheet: back (when nested), label, close. */
export function SheetHeader({ title, className }: { title: ReactNode; className?: string }) {
  const { stack, back, close } = useDash();
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 -mt-3 mb-1 flex h-14 items-center gap-1 bg-paper px-2 lg:-mx-6 lg:mt-0 lg:mb-2 lg:px-3",
        className,
      )}
    >
      {stack.length > 1 ? (
        <IconBtn label="Volver" onClick={back}>
          <ChevronLeft className="size-6" />
        </IconBtn>
      ) : null}
      <div className={cn("min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-soft", stack.length > 1 ? "" : "pl-2")}>{title}</div>
      <IconBtn label="Cerrar" onClick={close}>
        <X className="size-6" />
      </IconBtn>
    </div>
  );
}
