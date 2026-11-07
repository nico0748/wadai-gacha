"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#16122b", light: "#00000000" },
    })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div
      role="img"
      aria-label={label}
      className="aspect-square w-full rounded-[1.4rem] bg-paper p-[9%] shadow-[0_24px_50px_-20px_rgb(0_0_0/0.8)] [&_svg]:h-full [&_svg]:w-full"
    >
      {svg ? (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-paper-ink/10" />
      )}
    </div>
  );
}
