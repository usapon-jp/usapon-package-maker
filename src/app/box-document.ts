import { allRuntimeDesignAssets } from "../features/letter-set/mini-card-project";
import { writingFrameSchema } from "../features/letter-set/writing-frame";
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
import { normalizeLegacyPortraitCoverPlacements } from "./artwork";

const pageIdSchema = z.enum(["main", "lid", "base", "letter", "card"]);
const quarterTurnSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const envelopeFaceSchema = z.enum(["envelope-front", "envelope-flap", "envelope-back"]);
const assetRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), assetId: z.string().uuid() }),
  z.object({ kind: z.literal("builtin"), key: z.enum(BUILT_IN_STAMP_KEYS) }),
]);
const artworkBaseSchema = z.object({
  id: z.string().min(1),
  role: z.literal("background").default("background"),
  pageId: pageIdSchema,
  name: z.string().max(255),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  offsetXmm: z.number().finite(),
  offsetYmm: z.number().finite(),
  surfaceId: envelopeFaceSchema.optional(),
  themePresetId: z.string().max(120).optional(),
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
  repeatGapMm: z.number().nonnegative().finite().default(0),
  rotationDeg: quarterTurnSchema,
  coverFitVersion: z.literal(1).optional(),
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
  angleDeg: z.number().finite().default(0),
});
const stampSchema = runtimeAssetSchema.extend({
  id: z.string().min(1),
  kind: z.literal("stamp"),
  role: z.literal("stamp").default("stamp"),
  pageId: pageIdSchema,
  name: z.string().max(255),
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  widthMm: z.number().positive().finite(),
  rotationDeg: z.number().finite(),
  coverFitVersion: z.literal(1).optional(),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  surfaceId: envelopeFaceSchema.optional(),
  themePresetId: z.string().max(120).optional(),
});
const textSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("text"),
  role: z.enum(["text", "logoText"]).default("text"),
  pageId: pageIdSchema,
  text: z.string().max(80),
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  fontSizeMm: z.number().positive().finite(),
  color: z.string(),
  letterSpacingMm: z.number().finite().default(0),
  lineHeight: z.number().positive().finite().default(1.25),
  alignment: z.enum(["start", "middle", "end"]).default("middle"),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800), z.literal(900)]).default(700),
  arcMm: z.number().finite().default(0),
  strokeColor: z.string().nullable().default(null),
  strokeWidthMm: z.number().nonnegative().finite().default(0),
  labelColor: z.string().nullable().default(null),
  labelPaddingMm: z.number().nonnegative().finite().default(1.8),
  rotationDeg: z.number().finite().optional(),
  surfaceId: envelopeFaceSchema.optional(),
  themePresetId: z.string().max(120).optional(),
});
const persistedBoxTypeSchema = z.union([
  z.enum(["straight-tuck-carton-v1", "gift-box-v1", "two-piece-gift-box-v1", "letter-paper-v1", "envelope-v1", "mini-card-v1"]),
  z.literal("n-style-gift-box-v1"),
]).transform((type) => type === "n-style-gift-box-v1" ? "gift-box-v1" : type);

const cardDataSchema = z.object({
  backgroundColor: z.string(),
  artworkLayers: z.array(z.union([uploadedArtworkSchema, stripeSchema, dotSchema])),
  stamps: z.array(stampSchema), texts: z.array(textSchema),
  lineColors: z.object({ cut: z.string(), fold: z.string() }),
  frame: writingFrameSchema.optional(), showFrame: z.boolean(), showLines: z.boolean(),
  lineCount: z.number().int().min(2).max(5), lineWidth: z.number().min(50).max(92),
});
const miniCardProjectSchema = z.object({
  step: z.enum(["layout", "design", "arrange"]), activeId: z.string(),
  designs: z.array(z.object({ id: z.string(), name: z.string().max(60), copies: z.number().int().min(0).max(100), libraryId: z.string().optional(), data: cardDataSchema })).min(1).max(26),
  slots: z.array(z.string().nullable()).max(3000),
}).superRefine((project, context) => {
  const ids = new Set(project.designs.map((design) => design.id));
  if (ids.size !== project.designs.length || !ids.has(project.activeId) || project.slots.some((id) => id !== null && !ids.has(id))) context.addIssue({ code: "custom", message: "カードの割り当てが壊れています。" });
});

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
    envelopeConstruction: z.enum(["diamond", "kamasu"]).optional(),
  }),
  design: z.object({
    backgroundColors: z.object({
      main: z.string(),
      lid: z.string(),
      base: z.string(),
      letter: z.string().default("#fffdf9"),
      card: z.string().default("#fffdf9"),
    }),
    artworkLayers: z.array(z.union([uploadedArtworkSchema, stripeSchema, dotSchema])),
    stamps: z.array(stampSchema),
    texts: z.array(textSchema),
    lineColors: z.object({ cut: z.string(), fold: z.string() }),
    includeCalibrationPage: z.boolean(),
    printFoldoverLines: z.boolean().default(true),
    templateId: z.string().max(120).nullable().default(null),
    showWritingLines: z.boolean().default(false),
    showWritingFrame: z.boolean().default(false),
    writingLineCount: z.number().int().min(6).max(24).default(18),
    writingLineWidthPercent: z.number().int().min(50).max(94).default(82),
    showCardWritingLines: z.boolean().default(false),
    showCardWritingFrame: z.boolean().default(false),
    cardWritingLineCount: z.number().int().min(2).max(5).default(3),
    cardWritingLineWidthPercent: z.number().int().min(50).max(92).default(76),
    stationerySetSelection: z.enum(["envelope-only", "envelope-letter", "envelope-card", "envelope-letter-card"]).default("envelope-only"),
    envelopeDesign: z.object({
      style: z.enum(["cute", "adult", "simple"]),
      flapAccentEnabled: z.boolean(),
      flapColor: z.string(),
      flapPattern: z.enum(["solid", "dots", "stripes"]),
      showAddressField: z.boolean(),
      showAddressLines: z.boolean(),
      addressLineColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      addressLineCount: z.number().int().min(2).max(5).default(3),
      addressLineWidthPercent: z.number().int().min(50).max(92).default(76),
      marginMm: z.number().min(4).max(30),
    }).default({
      style: "simple",
      flapAccentEnabled: false,
      flapColor: "#fffdf9",
      flapPattern: "solid",
      showAddressField: false,
      showAddressLines: false,
      addressLineCount: 3,
      addressLineWidthPercent: 76,
      marginMm: 12,
    }),
    surfaceBackgroundColors: z.object({
      "envelope-front": z.string().optional(),
      "envelope-flap": z.string().optional(),
      "envelope-back": z.string().optional(),
    }).default({}),
    themePackId: z.string().max(120).nullable().default(null),
    miniCardProject: miniCardProjectSchema.optional(),
    writingFrames: z.partialRecord(pageIdSchema, writingFrameSchema).optional(),
    cardPrintCounts: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
    printGuideMode: z.enum(["assembly", "design"]).default("design"),
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

const CARD_ASSET_REFERENCE_PREFIX = "--mini-card-asset-";

// The existing save RPC validates user-asset references in the top-level arrays.
// Keep inactive card assets there as invisible references, so its ownership and
// cleanup checks continue to protect every image without changing DB permissions.
function documentStamps(state: AppState): PersistedStamp[] {
  const stamps = state.stamps.map(persistedStamp);
  if (!state.miniCardProject) return stamps;
  const known = new Set([...state.artworkLayers, ...state.stamps].flatMap((item) => "assetRef" in item && item.assetRef.kind === "user" ? [item.assetRef.assetId] : []));
  for (const item of allRuntimeDesignAssets(state)) {
    if (!("assetRef" in item) || item.assetRef.kind !== "user" || known.has(item.assetRef.assetId)) continue;
    known.add(item.assetRef.assetId);
    stamps.push({ id: `${CARD_ASSET_REFERENCE_PREFIX}${item.assetRef.assetId}`, kind: "stamp", role: "stamp", pageId: "card", name: item.fileName, assetRef: item.assetRef, fileName: item.fileName, sourceType: item.sourceType, aspectRatio: item.aspectRatio, visible: false, opacity: 0, widthMm: 1, xMm: 0, yMm: 0, rotationDeg: 0 });
  }
  return stamps;
}

export function serializeBoxDocument(state: AppState): BoxDocumentV1 {
  return {
    schemaVersion: 1,
    box: { ...state.box },
    design: {
      backgroundColors: { ...state.backgroundColors },
      artworkLayers: state.artworkLayers.map(persistedArtwork),
      stamps: documentStamps(state),
      texts: state.texts.map((item) => ({ ...item })),
      lineColors: { ...state.lineColors },
      includeCalibrationPage: state.includeCalibrationPage,
      printFoldoverLines: state.printFoldoverLines,
      templateId: state.templateId ?? null,
      showWritingLines: state.showWritingLines ?? false,
      showWritingFrame: state.showWritingFrame ?? false,
      writingLineCount: state.writingLineCount ?? 18,
      writingLineWidthPercent: state.writingLineWidthPercent ?? 82,
      showCardWritingLines: state.showCardWritingLines ?? false,
      showCardWritingFrame: state.showCardWritingFrame ?? false,
      cardWritingLineCount: state.cardWritingLineCount ?? 3,
      cardWritingLineWidthPercent: state.cardWritingLineWidthPercent ?? 76,
      stationerySetSelection: state.stationerySetSelection ?? "envelope-only",
      envelopeDesign: { ...state.envelopeDesign },
      surfaceBackgroundColors: { ...state.surfaceBackgroundColors },
      themePackId: state.themePackId,
      miniCardProject: state.miniCardProject ? { ...state.miniCardProject, designs: state.miniCardProject.designs.map((design) => ({ ...design, data: { ...design.data, artworkLayers: design.data.artworkLayers.map(persistedArtwork), stamps: design.data.stamps.map(persistedStamp) } })) } : undefined,
      writingFrames: state.writingFrames,
      cardPrintCounts: state.cardPrintCounts,
      printGuideMode: state.printGuideMode,
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
    Promise.all(document.design.stamps.filter((item) => !(document.design.miniCardProject && item.pageId === "card" && item.id.startsWith(CARD_ASSET_REFERENCE_PREFIX) && !item.visible)).map((item) => hydrateStamp(item, resolveAsset))),
  ]);
  return normalizeLegacyPortraitCoverPlacements({
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
    templateId: document.design.templateId,
    showWritingLines: document.design.showWritingLines,
    showWritingFrame: document.design.showWritingFrame,
    writingLineCount: document.design.writingLineCount,
    writingLineWidthPercent: document.design.writingLineWidthPercent,
    showCardWritingLines: document.design.showCardWritingLines,
    showCardWritingFrame: document.design.showCardWritingFrame,
    cardWritingLineCount: document.design.cardWritingLineCount,
    cardWritingLineWidthPercent: document.design.cardWritingLineWidthPercent,
    stationerySetSelection: document.design.stationerySetSelection,
    envelopeDesign: { ...document.design.envelopeDesign },
    activeEnvelopeFace: "envelope-flap",
    surfaceBackgroundColors: { ...document.design.surfaceBackgroundColors },
    themePackId: document.design.themePackId,
    miniCardProject: document.design.miniCardProject ? { ...document.design.miniCardProject, designs: await Promise.all(document.design.miniCardProject.designs.map(async (design) => ({ ...design, data: { ...design.data, artworkLayers: await Promise.all(design.data.artworkLayers.map((item) => hydrateArtwork(item, resolveAsset))), stamps: await Promise.all(design.data.stamps.map((item) => hydrateStamp(item, resolveAsset))) } }))) } : undefined,
    writingFrames: document.design.writingFrames,
    cardPrintCounts: document.design.cardPrintCounts,
    printGuideMode: document.design.printGuideMode,
  });
}

export function collectUserAssetIds(document: BoxDocumentV1): string[] {
  const ids = [...document.design.artworkLayers, ...document.design.stamps, ...(document.design.miniCardProject?.designs.flatMap((design) => [...design.data.artworkLayers, ...design.data.stamps]) ?? [])]
    .flatMap((item) => "assetRef" in item && item.assetRef.kind === "user" ? [item.assetRef.assetId] : []);
  return [...new Set(ids)];
}
