"use client";

import { useMemo } from "react";
import QRCode from "qrcode";
import { cx } from "./cx";

// QR of the ticket URL, drawn as one SVG path of square modules in the ink.
// Synchronous: qrcode's `create` builds the matrix, no canvas or data URL.

export function TicketQr({ value, className, label }: { value: string; className?: string; label: string }) {
  const { d, size } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let path = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.data[y * n + x]) path += `M${x + 2} ${y + 2}h1v1h-1z`;
      }
    }
    return { d: path, size: n + 4 };
  }, [value]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className={cx("block bg-sand-50", className)}>
      <path d={d} fill="var(--cobalt-800)" />
    </svg>
  );
}
