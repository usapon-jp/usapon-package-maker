import { z } from "zod";

import type {
  AppState,
  ArtworkLayer,
  AssetRef,
  DotPatternLayer,
  StampItem,
  StripePatternLayer,
  TextItem,
  UploadedArtworkLayer,
} from "./app-types";
import { BUILT_IN_STAMP_KEYS } from "./app-types";
import { initialState } from "./app-state";

const pageIdSchema = z.enum(["main", "lid", "base"]);
const quarterTurnSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const assetRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), assetId: z.string().uuid() }),
  z.object({ kind: z.literal("builtin"), key: z.enum(BUILT_IN_STAMP_KEYS) }),
]);
const artworkBaseSchema = z.object({
  id: z.string().min(1),
  pageId: pageIdSchema,
  name: z.string().max(255),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  offsetXmm: z.number().finite(),
  offsetYmm: z.number().finite(),
});
const runtimeAssetSchema = z.object({
  assetRef: assetRefSchema,
  fileName: z.string().min(1).max(255),
  sourceType: z.enum(["png", "svg"]),
  aspectRatio: z.number().positive().finite(),
});
const uploadedArtworkSchema = artworkBaseSchema.extend({
  kind: z.literal("uploaded-artwork"),
  widthMm: z.number().positive().finite(),
  repeat: z.boolean(),
  rotationDeg: quarterTurnSchema,
}).merge(runtimeAssetSchema);
const stripeSchema = artworkBaseSchema.extend({
  kind: z.literal("stripe-pattern"),
  color: z.string(),
  stripeWidthMm: z.number().positive().finite(),
  gapMm: z.number().positive().finite(),
  angleDeg: z.union([z.literal(0), z.literal(45), z.literal(90), z.literal(135)]),
});
const dotSchema = artworkBaseSchema.extend({
  kind: z.literal("dot-pattern"),
  color: z.string(),
  dotDiameterMm: z.number().positive().finite(),
  spacingMm: z.number().positive().finite(),
});
const stampSchema = runtimeAssetSchema.extend({
  id: z.string().min(1),
  kind: z.literal("stamp"),
  pageId: pageIdSchema,
  name: z.string().max(255),
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  widthMm: z.number().positive().finite(),
  rotationDeg: quarterTurnSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
});
const textSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("text"),
  pageId: pageIdSchema,
  text: z.string().max(40),
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  fontSizeMm: z.number().positive().finite(),
  color: z.string(),
});
const persistedBoxTypeSchema = z.union([
  z.enum(["straight-tuck-carton-v1", "gift-box-v1", "two-piece-gift-box-v1"]),
  z.literal("n-style-gift-box-v1"),
]).transform((type) => type === "n-style-gift-box-v1" ? "gift-box-v1" : type);

export const boxDocumentV1Schema = z.object({
  schemaVersion: z.literal(1),
  box: z.object({
    // Existing N-style projects are kept, but open as the supported shallow gift box.
    type: persistedBoxTypeSchema,
    widthMm: z.number().positive().finite(),
    depthMm: z.number().positive().finite(),
    heightMm: z.number().positive().finite(),
    paperThicknessMm: z.number().positive().finite(),
    glueFlapMm: z.number().nonnegative().finite(),
    lidDepthMm: z.number().positive().finite().optional(),
    lidClearanceMm: z.number().nonnegative().finite().optional(),
    foldoverMm: z.number().positive().finite().optional(),
  }),
  design: z.object({
    backgroundColors: z.object({ main: z.string(), lid: z.string(), base: z.string() }),
    artworkLayers: z.array(z.union([uploadedArtworkSchema, stripeSchema, dotSchema])),
    stamps: z.array(stampSchema),
    texts: z.array(textSchema),
    lineColors: z.object({ cut: z.string(), fold: z.string() }),
    includeCalibrationPage: z.boolean(),
    printFoldoverLines: z.boolean().default(true),
  }),
});

export type BoxDocumentV1 = z.infer<typeof boxDocumentV1Schema>;
export type PersistedUploadedArtwork = z.infer<typeof uploadedArtworkSchema>;
export type PersistedStamp = z.infer<typeof stampSchema>;

export type AssetResolver = (
  ref: AssetRef,
  metadata: { fileName: string; sourceType: "png" | "svg"; aspectRatio: number },
) => Promise<{ dataUrl: string; blob?: Blob }>;

function persistedArtwork(item: ArtworkLayer): BoxDocumentV1["design"]["artworkLayers"][number] {
  if (item.kind !== "uploaded-artwork") return { ...item } as StripePatternLayer | DotPatternLayer;
  const { dataUrl: _dataUrl, blob: _blob, ...persisted } = item;
  return persisted;
}

function persistedStamp(item: StampItem): BoxDocumentV1["design"]["stamps"][number] {
  const { dataUrl: _dataUrl, blob: _blob, ...persisted } = item;
  return persisted;
}

export function serializeBoxDocument(state: AppState): BoxDocumentV1 {
  return {
    schemaVersion: 1,
    box: { ...state.box },
    design: {
      backgroundColors: { ...state.backgroundColors },
      artworkLayers: state.artworkLayers.map(persistedArtwork),
      stamps: state.stamps.map(persistedStamp),
      texts: state.texts.map((item) => ({ ...item })),
      lineColors: { ...state.lineColors },
      includeCalibrationPage: state.includeCalibrationPage,
      printFoldoverLines: state.printFoldoverLines,
    },
  };
}

export function parseBoxDocument(value: unknown): BoxDocumentV1 {
  const parsed = boxDocumentV1Schema.safeParse(value);
  if (!parsed.success) throw new Error("作品データの形式が壊れているか、このアプリではまだ開けません。");
  return parsed.data;
}

async function hydrateArtwork(item: BoxDocumentV1["design"]["artworkLayers"][number], resolveAsset: AssetResolver): Promise<ArtworkLayer> {
  if (item.kind !== "uploaded-artwork") return { ...item } as StripePatternLayer | DotPatternLayer;
  const runtime = await resolveAsset(item.assetRef, item);
  return { ...item, ...runtime } as UploadedArtworkLayer;
}

async function hydrateStamp(item: BoxDocumentV1["design"]["stamps"][number], resolveAsset: AssetResolver): Promise<StampItem> {
  const runtime = await resolveAsset(item.assetRef, item);
  return { ...item, ...runtime } as StampItem;
}

export async function hydrateBoxDocument(value: unknown, resolveAsset: AssetResolver): Promise<AppState> {
  const document = parseBoxDocument(value);
  const [artworkLayers, stamps] = await Promise.all([
    Promise.all(document.design.artworkLayers.map((item) => hydrateArtwork(item, resolveAsset))),
    Promise.all(document.design.stamps.map((item) => hydrateStamp(item, resolveAsset))),
  ]);
  return {
    ...initialState,
    screen: "design",
    box: { ...document.box },
    activePageId: document.box.type === "two-piece-gift-box-v1" ? "lid" : "main",
    backgroundColors: { ...document.design.backgroundColors },
    artworkLayers,
    stamps,
    texts: document.design.texts.map((item) => ({ ...item } as TextItem)),
    lineColors: { ...document.design.lineColors },
    includeCalibrationPage: document.design.includeCalibrationPage,
    printFoldoverLines: document.design.printFoldoverLines,
  };
}

export function collectUserAssetIds(document: BoxDocumentV1): string[] {
  const ids = [...document.design.artworkLayers, ...document.design.stamps]
    .flatMap((item) => "assetRef" in item && item.assetRef.kind === "user" ? [item.assetRef.assetId] : []);
  return [...new Set(ids)];
}
