import { Briefcase, Cake, PartyPopper, Plane, Users, type LucideIcon } from "lucide-react";

import type { EventType } from "@/lib/types";

// §6.2 / §13.8 — per-type icon + hue.
// Hue is used for the chip's icon, the 2px team-stripe fallback (we always
// have team color), and the tinted fill+border (computed inline because
// rgba() with the SAME hex for fill and border just at different opacities
// is too verbose to bake into static classes).
interface TypeStyle {
  icon: LucideIcon;
  hue: string; // hex of the type's accent color (#RRGGBB)
}

export const EVENT_TYPE_STYLE: Record<EventType, TypeStyle> = {
  Personal: { icon: Briefcase, hue: "#2563EB" },
  Birthday: { icon: Cake, hue: "#A855F7" },
  Holiday: { icon: PartyPopper, hue: "#F97316" },
  Travel: { icon: Plane, hue: "#22C55E" },
  Other: { icon: Users, hue: "#71717A" },
};

// hex → rgba with the given alpha. Accepts #RGB or #RRGGBB.
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const expand = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
