import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The project's type steps (text-small … text-display) are font sizes, not
// colours: without this, `cn("text-small text-ink")` would drop the size.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["small", "body", "lead", "head", "display"],
      radius: ["ticket", "field", "stub"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
