"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Every Motion animation in the app follows the OS "reduce motion" setting:
 * movement and layout animations are skipped, opacity still fades.
 */
export function AppMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
