import { getSizeDimensions } from "./size-presets";

export function getResponsiveSpanClasses(preset: string): string {
  const size = getSizeDimensions(preset);
  return `yh-tablet-span-${Math.min(size.w, 3)} yh-compact-span-${Math.min(size.w, 2)} yh-row-span-${size.h} yh-col-span-${size.w}`;
}
