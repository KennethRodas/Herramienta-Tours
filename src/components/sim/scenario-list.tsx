"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { SCENARIOS } from "@/lib/sim/scenarios";
import { cn } from "@/lib/utils";

export function ScenarioList({ className }: { className?: string }) {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const run = async (id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id)!;
    setRunning(id);
    try {
      const out = await sc.run();
      setResults((r) => ({ ...r, [id]: out }));
      toast(sc.title, { description: out });
    } catch (e) {
      setResults((r) => ({ ...r, [id]: `Error: ${(e as Error).message}` }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <ul className={cn("space-y-2 font-sans", className)}>
      {SCENARIOS.map((s) => (
        <li key={s.id} className="bg-cobalt-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[17px] font-semibold leading-tight">{s.title}</p>
              <p className="mt-1 text-[15px] leading-snug text-cobalt-200">{s.description}</p>
            </div>
            <button
              type="button"
              disabled={running !== null}
              onClick={() => void run(s.id)}
              className="pressable h-10 shrink-0 rounded-full bg-sand-100 px-4 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-50 disabled:opacity-50"
            >
              {running === s.id ? "Corriendo…" : "Correr"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {results[s.id] && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <span className="mt-3 block text-[15px] leading-snug text-sand-50">{results[s.id]}</span>
                <span className="mt-1 block text-[14px] text-cobalt-300">Mirá: {s.watch}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ul>
  );
}
