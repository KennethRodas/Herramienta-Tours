"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { CalendarDays, Plus, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DateRangePicker,
  DateRangePickerCalendar,
  DateRangePickerContent,
  DateRangePickerGrid,
  DateRangePickerHeader,
  DateRangePickerTrigger,
  type DateRange,
} from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import { PullToRefresh } from "@/components/motion/pull-to-refresh";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Table, type SortState, type TableColumn } from "@/components/motion/table";
import type { Booking, BookingStatus, Departure, Tour } from "@/lib/domain/types";
import { addDays, formatDayShort, formatPhone, formatTime24, plural, svDateKey } from "@/lib/domain/format";
import { useNow } from "@/lib/sim/hooks";
import { cn } from "@/lib/utils";
import { useDash } from "../context";
import { useIndex, useIsDesktop } from "../hooks";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_ORDER, MONTHS_SHORT, SOURCE_LABEL, keyParts, paymentLine, paymentShort } from "../lib";
import { Btn, Chips, Empty, Stamp, StatusTag } from "../ui";

type Fechas = "proximas" | "hoy" | "7d" | "pasadas" | "todas" | "rango";
type Estado = "activas" | "todas" | BookingStatus;

interface Row {
  b: Booking;
  dep?: Departure;
  tour?: Tour;
  ref: string;
  start: number;
  day: string;
  text: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const shortDate = (key: string) => {
  const p = keyParts(key);
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}`;
};

/** Value that follows an incoming prop (URL filter) and can still be changed here. */
function useFromProp<T>(prop: T, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(prop ?? fallback);
  const [prev, setPrev] = useState(prop);
  if (prop !== prev) {
    setPrev(prop);
    setValue(prop ?? fallback);
  }
  return [value, setValue];
}

export function ReservasScreen({ estado: estadoProp, tour: tourProp, q: qProp }: { estado?: string; tour?: string; q?: string }) {
  const idx = useIndex();
  const now = useNow(30_000);
  const desktop = useIsDesktop();
  const { open } = useDash();
  const [q, setQ] = useFromProp(qProp ?? "", "");
  const [estado, setEstado] = useFromProp<Estado>((estadoProp as Estado | undefined) ?? "activas", "activas");
  const [tour, setTour] = useFromProp(tourProp ?? "todos", "todos");
  const [fechas, setFechas] = useState<Fechas>(estadoProp ? "todas" : "proximas");
  const [range, setRange] = useState<DateRange | null>(null);
  const [sort, setSort] = useState<SortState | null>({ key: "fecha", direction: "asc" });
  const [mobileSort, setMobileSort] = useState<"salida" | "recientes">("salida");

  const rows = useMemo<Row[]>(() => {
    if (!idx) return [];
    return idx.s.bookings.map((b) => {
      const dep = idx.departureById.get(b.departureId);
      const tour = idx.tourById.get(b.tourId);
      const ref = dep ? (idx.refs.get(dep.id) ?? "") : "";
      const start = dep ? Date.parse(dep.startsAt) : 0;
      return {
        b,
        dep,
        tour,
        ref,
        start,
        day: dep ? svDateKey(dep.startsAt) : "",
        text: norm(`${b.code} ${b.code.slice(4)} ${b.name} ${b.phone} ${b.email ?? ""} ${ref} ${tour?.name ?? ""}`),
      };
    });
  }, [idx]);

  const today = now !== null ? svDateKey(now) : "";
  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (estado === "activas" ? r.b.status === "cancelada" : estado !== "todas" && r.b.status !== estado) return false;
      if (tour !== "todos" && r.b.tourId !== tour) return false;
      if (fechas === "proximas" && r.day < today) return false;
      if (fechas === "hoy" && r.day !== today) return false;
      if (fechas === "7d" && (r.day < today || r.day > addDays(today, 6))) return false;
      if (fechas === "pasadas" && r.day >= today) return false;
      if (fechas === "rango" && range && (r.day < range.from || r.day > (range.to ?? range.from))) return false;
      if (words.length && !words.every((w) => r.text.includes(w)) && !(digits.length >= 4 && r.b.phone.includes(digits))) return false;
      return true;
    });
  }, [rows, estado, tour, fechas, range, q, today]);

  const people = filtered.reduce((n, r) => n + (r.b.status === "cancelada" ? 0 : r.b.partySize), 0);

  if (!idx || now === null) return <div className="h-[520px] animate-pulse bg-paper" aria-busy="true" />;

  const clear = () => {
    setQ("");
    setEstado("activas");
    setTour("todos");
    setFechas("proximas");
    setRange(null);
  };
  const dirty = q !== "" || estado !== "activas" || tour !== "todos" || fechas !== "proximas";

  return (
    <div className="flex flex-col gap-3">
      {/* Filters: one row above everything they scope */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <Input
          aria-label="Buscar"
          value={q}
          onChange={setQ}
          placeholder="Código, nombre o WhatsApp"
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          leftIcon={<Search />}
          rightIcon={
            q ? (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")}>
                <X />
              </button>
            ) : undefined
          }
          className="lg:w-80"
          classNames={{ field: "h-12 rounded-none bg-paper", input: "text-[16px]" }}
        />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Select value={estado} onValueChange={(v) => setEstado(v as Estado)} className="lg:w-52">
            <SelectTrigger className="h-12 rounded-none! bg-paper text-[15px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-none!">
              <SelectItem value="activas" className="rounded-none py-2 text-[15px]">
                Activas
              </SelectItem>
              <SelectItem value="todas" className="rounded-none py-2 text-[15px]">
                Todos los estados
              </SelectItem>
              {BOOKING_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="rounded-none py-2 text-[15px]">
                  {BOOKING_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tour} onValueChange={setTour} className="lg:w-52">
            <SelectTrigger className="h-12 rounded-none! bg-paper text-[15px]">
              <SelectValue placeholder="Tour" />
            </SelectTrigger>
            <SelectContent className="max-h-80 overflow-y-auto rounded-none!">
              <SelectItem value="todos" className="rounded-none py-2 text-[15px]">
                Todos los tours
              </SelectItem>
              {idx.tours.map((t) => (
                <SelectItem key={t.id} value={t.id} className="rounded-none py-2 text-[15px]">
                  {t.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:px-0 lg:pb-0">
          <Chips<Fechas>
            label="Fechas"
            value={fechas}
            onChange={(v) => {
              setFechas(v);
              if (v !== "rango") setRange(null);
            }}
            className="flex-nowrap"
            options={[
              { value: "proximas", label: "Próximas" },
              { value: "hoy", label: "Hoy" },
              { value: "7d", label: "7 días" },
              { value: "pasadas", label: "Pasadas" },
              { value: "todas", label: "Todas" },
            ]}
          />
          <DateRangePicker
            value={range}
            onValueChange={(r) => {
              setRange(r);
              setFechas(r ? "rango" : "proximas");
            }}
            locale="es-SV"
            label="Rango de fechas"
            closeOnSelect
            showSummary={false}
          >
            <DateRangePickerTrigger
              aria-label="Rango de fechas"
              className={cn("h-10 shrink-0 rounded-none border-0 px-3 text-[15px] font-semibold", fechas === "rango" ? "bg-ink text-paper hover:bg-ink" : "bg-ink/8 text-ink hover:bg-ink/14")}
              style={{ borderRadius: 0 }}
            >
              <CalendarDays className="size-4" aria-hidden />
              {range ? (range.to && range.to !== range.from ? `${shortDate(range.from)} – ${shortDate(range.to)}` : `Desde ${shortDate(range.from)}`) : "Rango"}
            </DateRangePickerTrigger>
            <DateRangePickerContent className="rounded-none">
              <DateRangePickerCalendar showSummary={false} className="rounded-none border-0">
                <DateRangePickerHeader />
                <DateRangePickerGrid />
              </DateRangePickerCalendar>
            </DateRangePickerContent>
          </DateRangePicker>
        </div>
        {desktop ? (
          <Btn className="lg:ml-auto" onClick={() => open({ kind: "new-booking" })}>
            <Plus className="size-4" /> Reserva manual
          </Btn>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-ink-soft" aria-live="polite">
          <span className="font-semibold text-ink">{plural(filtered.length, "reserva", "reservas")}</span> · {plural(people, "persona", "personas")}
          {dirty ? (
            <button type="button" onClick={clear} className="pressable ml-2 font-semibold text-ink underline underline-offset-4">
              Quitar filtros
            </button>
          ) : null}
        </p>
        {!desktop ? (
          <div className="flex items-center gap-2">
            <Chips<"salida" | "recientes">
              label="Orden"
              size="sm"
              value={mobileSort}
              onChange={setMobileSort}
              options={[
                { value: "salida", label: "Por salida" },
                { value: "recientes", label: "Recientes" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {desktop ? (
        <DesktopTable rows={filtered} sort={sort} onSort={setSort} onOpen={(id) => open({ kind: "booking", id })} onClear={clear} />
      ) : (
        <MobileList
          rows={[...filtered].sort((a, b) => (mobileSort === "salida" ? a.start - b.start : Date.parse(b.b.createdAt) - Date.parse(a.b.createdAt)))}
          onOpen={(id) => open({ kind: "booking", id })}
          onNew={() => open({ kind: "new-booking" })}
          onClear={clear}
        />
      )}
    </div>
  );
}

// --- Desktop: virtualized table ----------------------------------------------------------

function useFillHeight(bottom: number, min = 320) {
  const [height, setHeight] = useState<number | null>(null);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      // Offset from the top of the document, so a scrolled page measures the same.
      const measure = () => setHeight(Math.max(min, Math.round(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - bottom)));
      const ro = new ResizeObserver(measure);
      ro.observe(document.body);
      window.addEventListener("resize", measure);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", measure);
      };
    },
    [bottom, min],
  );
  return [ref, height] as const;
}

function DesktopTable({
  rows,
  sort,
  onSort,
  onOpen,
  onClear,
}: {
  rows: Row[];
  sort: SortState | null;
  onSort: (s: SortState | null) => void;
  onOpen: (id: string) => void;
  onClear: () => void;
}) {
  const [ref, height] = useFillHeight(40, 360);
  const columns: TableColumn<Row>[] = [
    {
      key: "codigo",
      header: "Código",
      width: "116px",
      sortable: true,
      sortValue: (r) => r.b.code,
      cell: (r) => (
        <button type="button" data-row={r.b.id} onClick={() => onOpen(r.b.id)} className="font-display text-[17px] font-bold uppercase tracking-[0.01em] text-ink hover:underline">
          {r.b.code}
        </button>
      ),
    },
    { key: "nombre", header: "Nombre", sortable: true, sortValue: (r) => r.b.name, cell: (r) => <span className="font-semibold">{r.b.name}</span> },
    { key: "whatsapp", header: "WhatsApp", width: "148px", cell: (r) => <span className="tabular">{formatPhone(r.b.phone)}</span> },
    {
      key: "tour",
      header: "Tour",
      width: "170px",
      sortable: true,
      sortValue: (r) => r.tour?.shortName ?? "",
      cell: (r) => (
        <span>
          <span className="font-display font-bold uppercase">{r.ref}</span> {r.tour?.shortName}
        </span>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      width: "150px",
      sortable: true,
      sortValue: (r) => r.start,
      cell: (r) => (r.dep ? <span className="tabular">{`${formatDayShort(r.dep.startsAt)} ${formatTime24(r.dep.startsAt)}`}</span> : "—"),
    },
    { key: "personas", header: "Pers.", width: "76px", align: "right", sortable: true, sortValue: (r) => r.b.partySize, cell: (r) => <span className="tabular font-semibold">{r.b.partySize}</span> },
    { key: "estado", header: "Estado", width: "168px", sortable: true, sortValue: (r) => BOOKING_STATUS_ORDER.indexOf(r.b.status), cell: (r) => (r.dep?.status === "cancelada" && r.b.status !== "cancelada" ? <Stamp tilt={false} className="text-[12px]">Salida cancelada</Stamp> : <StatusTag status={r.b.status} />) },
    { key: "pago", header: "Pago", width: "140px", sortable: true, sortValue: (r) => paymentShort(r.b), cell: (r) => paymentShort(r.b) },
    { key: "canal", header: "Canal", width: "112px", sortable: true, sortValue: (r) => SOURCE_LABEL[r.b.source], cell: (r) => SOURCE_LABEL[r.b.source] },
  ];
  return (
    <div
      ref={ref}
      // The whole row opens the booking; the code button carries keyboard access.
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        const id = target.closest("tr")?.querySelector<HTMLElement>("[data-row]")?.dataset.row;
        if (id) onOpen(id);
      }}
      className="[&_tbody_tr]:cursor-pointer [&_tbody_tr:hover]:bg-ink/6 [&_td]:text-[14px] [&_th]:text-[13px]"
    >
      <Table
        data={rows}
        columns={columns}
        getRowId={(r) => r.b.id}
        sort={sort}
        onSortChange={onSort}
        rowHeight={52}
        height={height ?? 560}
        emptyState={
          <span className="flex flex-col items-center gap-3">
            Ninguna reserva coincide con los filtros.
            <Btn size="sm" variant="quiet" onClick={onClear}>
              Quitar filtros
            </Btn>
          </span>
        }
        className="border-0 bg-paper text-paper-ink"
      />
    </div>
  );
}

// --- Phone: virtualized cards inside pull-to-refresh -------------------------------------------

function MobileList({ rows, onOpen, onNew, onClear }: { rows: Row[]; onOpen: (id: string) => void; onNew: () => void; onClear: () => void }) {
  const [ref, height] = useFillHeight(0, 300);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    setScroller(el?.closest("section") ?? null);
  }, []);
  // The virtualizer re-renders this list itself; nothing here is memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller,
    estimateSize: () => 112,
    overscan: 6,
  });

  return (
    <div ref={ref} className="-mx-4 -mb-[calc(env(safe-area-inset-bottom,0px)+116px)] sm:-mx-6">
      <PullToRefresh
        onRefresh={async () => {
          await new Promise((r) => setTimeout(r, 650));
          toast(`Al día · ${plural(rows.length, "reserva", "reservas")}`);
        }}
        pullingLabel="Deslizá para actualizar"
        releaseLabel="Soltá para actualizar"
        refreshingLabel="Actualizando"
        ariaLabel="Reservas"
        className="bg-ground"
        contentClassName="bg-ground"
        indicatorClassName="bg-none bg-ground text-ink-soft"
      >
        <div ref={contentRef} style={{ height: height ?? 600 }} className="px-4 sm:px-6">
          {rows.length ? (
            <div style={{ height: virtual.getTotalSize() + 140, position: "relative" }}>
              {virtual.getVirtualItems().map((item) => {
                const r = rows[item.index];
                return (
                  <div key={r.b.id} data-index={item.index} ref={virtual.measureElement} className="absolute inset-x-0 pb-1.5" style={{ transform: `translateY(${item.start}px)` }}>
                    <MobileCard r={r} onOpen={onOpen} />
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              action={
                <div className="flex gap-2">
                  <Btn size="sm" variant="quiet" onClick={onClear}>
                    Quitar filtros
                  </Btn>
                  <Btn size="sm" onClick={onNew}>
                    Reserva manual
                  </Btn>
                </div>
              }
            >
              Ninguna reserva coincide con los filtros.
            </Empty>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}

function MobileCard({ r, onOpen }: { r: Row; onOpen: (id: string) => void }) {
  const { b, dep, tour } = r;
  return (
    <button type="button" onClick={() => onOpen(b.id)} className="pressable flex w-full flex-col gap-1.5 bg-paper px-4 py-3 text-left text-paper-ink active:bg-surface-2">
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[19px] font-bold uppercase leading-none tracking-[0.01em]">{b.code}</span>
          <span className={cn("mt-1 truncate text-[17px] font-semibold leading-tight", b.status === "cancelada" && "line-through opacity-60")}>{b.name}</span>
        </span>
        {dep?.status === "cancelada" && b.status !== "cancelada" ? <Stamp tilt={false} className="shrink-0 text-[12px]">Salida cancelada</Stamp> : <StatusTag status={b.status} className="shrink-0" />}
      </span>
      <span className="truncate text-[14px] leading-snug text-ink">
        {r.ref} · {tour?.shortName} · {dep ? `${formatDayShort(dep.startsAt)} ${formatTime24(dep.startsAt)}` : "sin salida"} · {plural(b.partySize, "pers.", "pers.")}
      </span>
      <span className="truncate text-[13px] leading-snug text-ink-soft">
        {paymentLine(b, dep?.priceUsd ?? tour?.priceUsd ?? 0)} · {SOURCE_LABEL[b.source]} · {formatPhone(b.phone)}
      </span>
    </button>
  );
}
