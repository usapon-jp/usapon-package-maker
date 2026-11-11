import { z } from "zod";
import type { DielineGeometry } from "../../domain/boxes/types";

export const writingFrameSchema = z.object({
  shape: z.enum(["rectangle", "rounded", "ellipse", "bubble"]).default("rounded"),
  opacity: z.number().min(0).max(1).default(0.92),
  scale: z.number().min(0.2).max(2).default(1),
  widthScale: z.number().min(0.2).max(2).default(1),
  heightScale: z.number().min(0.2).max(2).default(1),
  rotationDeg: z.number().min(-180).max(180).default(0),
  offsetXmm: z.number().finite().default(0),
  offsetYmm: z.number().finite().default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});
export type WritingFrameSettings = z.infer<typeof writingFrameSchema>;
export const DEFAULT_WRITING_FRAME: WritingFrameSettings = writingFrameSchema.parse({});
export function writingFrameBounds(geometry: DielineGeometry, settings = DEFAULT_WRITING_FRAME) {
  const card = geometry.type === "mini-card-v1";
  const width = Math.max(1, geometry.bounds.widthMm - (card ? 14 : 28)) * settings.scale * settings.widthScale;
  const height = Math.max(1, geometry.bounds.heightMm - (card ? 14 : 40)) * settings.scale * settings.heightScale;
  return { width, height, x: geometry.bounds.x + geometry.bounds.widthMm / 2 + settings.offsetXmm, y: geometry.bounds.y + geometry.bounds.heightMm / 2 + settings.offsetYmm };
}
