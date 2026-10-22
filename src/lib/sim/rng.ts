// Seeded PRNG (mulberry32) so a simulation can be replayed exactly.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length)];

export const between = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Weighted pick: weights need not sum to 1. */
export function weighted<T>(rng: Rng, items: readonly [T, number][]) {
  const total = items.reduce((n, [, w]) => n + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[items.length - 1][0];
}

export const uid = (rng: Rng = Math.random, prefix = "") =>
  `${prefix}${Math.floor(rng() * 0xffffffff).toString(36)}${Math.floor(rng() * 0xffff).toString(36)}`;

const FIRST = [
  "María José", "Carlos", "Fátima", "Kevin", "Gabriela", "José Roberto", "Andrea", "Diego", "Daniela", "Rodrigo",
  "Katherine", "Bryan", "Alejandra", "Óscar", "Valeria", "Mauricio", "Sofía", "Ernesto", "Camila", "Rafael",
  "Paola", "Josué", "Michelle", "Francisco", "Tatiana", "Héctor", "Nathaly", "Samuel", "Vanessa", "Emilio",
];
const LAST = [
  "Hernández", "López", "Martínez", "Rivas", "Flores", "Ramírez", "Cruz", "Pérez", "Rodríguez", "Mejía",
  "Portillo", "Alvarado", "Guevara", "Ayala", "Orellana", "Castro", "Menjívar", "Escobar", "Quintanilla", "Argueta",
];

export function fakePerson(rng: Rng) {
  const first = pick(rng, FIRST);
  const last = `${pick(rng, LAST)} ${pick(rng, LAST)}`;
  const name = `${first} ${last.split(" ")[0]}`;
  const phone = `503${pick(rng, ["6", "7"])}${String(between(rng, 0, 9999999)).padStart(7, "0")}`;
  const handle = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".");
  const email = rng() < 0.55 ? `${handle}.${last.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@correo.sv` : undefined;
  return { name, phone, email };
}
