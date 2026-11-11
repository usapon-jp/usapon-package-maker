import type { AppAction, AppState, ArtworkLayer, DielineLineColors, StampItem, TextItem } from "../../app/app-types";
import type { WritingFrameSettings } from "./writing-frame";
import { printImposition } from "../../domain/paper/imposition";
import { generateDieline } from "../../domain/boxes/registry";

export type CardDesignData = {
  backgroundColor: string;
  artworkLayers: ArtworkLayer[];
  stamps: StampItem[];
  texts: TextItem[];
  lineColors: DielineLineColors;
  frame?: WritingFrameSettings;
  showFrame: boolean;
  showLines: boolean;
  lineCount: number;
  lineWidth: number;
};
export type CardDesign = { id: string; name: string; copies: number; libraryId?: string; data: CardDesignData };
export type MiniCardProject = { step: "layout" | "design" | "arrange"; activeId: string; designs: CardDesign[]; slots: Array<string | null> };
export type MiniCardAction =
  | { type: "card-step"; step: MiniCardProject["step"] }
  | { type: "card-select"; id: string }
  | { type: "card-add"; id: string; duplicate?: boolean; data?: CardDesignData; name?: string; libraryId?: string }
  | { type: "card-copies"; id: string; copies: number }
  | { type: "card-place"; index: number; id: string | null }
  | { type: "card-library-id"; id: string; libraryId: string }
  | { type: "card-rename"; id: string; name: string };

export function captureCardDesign(state: AppState): CardDesignData {
  return { backgroundColor: state.backgroundColors.main, artworkLayers: state.artworkLayers.filter((item) => item.pageId === "main"), stamps: state.stamps.filter((item) => item.pageId === "main"), texts: state.texts.filter((item) => item.pageId === "main"), lineColors: { ...state.lineColors }, frame: state.writingFrames?.main, showFrame: state.showCardWritingFrame, showLines: state.showCardWritingLines, lineCount: state.cardWritingLineCount, lineWidth: state.cardWritingLineWidthPercent };
}
export function applyCardDesign(state: AppState, data: CardDesignData): AppState {
  const writingFrames = { ...state.writingFrames };
  if (data.frame) writingFrames.main = data.frame; else delete writingFrames.main;
  return { ...state, backgroundColors: { ...state.backgroundColors, main: data.backgroundColor }, artworkLayers: data.artworkLayers.map((item) => ({ ...item, pageId: "main" })), stamps: data.stamps.map((item) => ({ ...item, pageId: "main" })), texts: data.texts.map((item) => ({ ...item, pageId: "main" })), lineColors: { ...data.lineColors }, writingFrames, showCardWritingFrame: data.showFrame, showCardWritingLines: data.showLines, cardWritingLineCount: data.lineCount, cardWritingLineWidthPercent: data.lineWidth, selectedArtworkId: null, selectedStampId: null, selectedTextId: null };
}
export function cardCapacity(state: AppState) { return printImposition(generateDieline(state.box)).count; }
export function reconcileCardSlots(slots: Array<string | null>, designs: CardDesign[], capacity: number): Array<string | null> {
  const counts = new Map(designs.map((design) => [design.id, design.copies]));
  const next = slots.map((id) => {
    if (!id || (counts.get(id) ?? 0) <= 0) return null;
    counts.set(id, counts.get(id)! - 1); return id;
  });
  for (const [id, count] of counts) for (let n = 0; n < count; n++) { const empty = next.indexOf(null); if (empty < 0) next.push(id); else next[empty] = id; }
  while (next.length > capacity && next.slice(-capacity).every((id) => id === null)) next.splice(-capacity);
  const length = Math.max(capacity, Math.ceil(next.length / capacity) * capacity);
  return [...next, ...Array<string | null>(length - next.length).fill(null)];
}
export function createMiniCardProject(state: AppState): MiniCardProject {
  const data = captureCardDesign(state);
  const capacity = cardCapacity(state);
  let designs: CardDesign[];
  if (state.cardPrintCounts) {
    designs = state.stamps.filter((item) => item.pageId === "main" && item.visible && (state.cardPrintCounts?.[item.id] ?? 0) > 0).map((item, index) => ({ id: `card-${index}`, name: `デザイン${String.fromCharCode(65 + index)}`, copies: state.cardPrintCounts![item.id], data: { ...data, stamps: [item] } }));
  } else {
    const hasDesign = data.artworkLayers.length || data.stamps.length || data.texts.length || data.showFrame || data.backgroundColor !== "#fffdf9";
    designs = [{ id: "card-a", name: "デザインA", copies: hasDesign ? capacity : 4, data }, { id: "card-b", name: "デザインB", copies: hasDesign ? 0 : 4, data: { ...data, artworkLayers: [], stamps: [], texts: [], showFrame: false, showLines: false, backgroundColor: "#fffdf9" } }];
  }
  if (!designs.length) designs = [{ id: "card-a", name: "デザインA", copies: 0, data }];
  return { step: "layout", activeId: designs[0].id, designs, slots: reconcileCardSlots([], designs, capacity) };
}
export function syncCardProject(state: AppState): AppState {
  if (state.box.type !== "mini-card-v1" || !state.miniCardProject) return state;
  return { ...state, miniCardProject: { ...state.miniCardProject, designs: state.miniCardProject.designs.map((design) => design.id === state.miniCardProject!.activeId ? { ...design, data: captureCardDesign(state) } : design) } };
}
export function reduceMiniCardAction(state: AppState, action: AppAction): AppState | null {
  if (!action.type.startsWith("card-")) return null;
  const project = syncCardProject(state).miniCardProject;
  if (!project) return state;
  const next = { ...project, designs: [...project.designs] };
  const cardAction = action as MiniCardAction;
  if (cardAction.type === "card-step") return { ...state, screen: "design", miniCardProject: { ...project, step: cardAction.step } };
  if (cardAction.type === "card-select") {
    const design = project.designs.find((item) => item.id === cardAction.id);
    return design ? { ...applyCardDesign(state, design.data), miniCardProject: { ...project, activeId: design.id } } : state;
  }
  if (cardAction.type === "card-add") {
    if (project.designs.length >= 26 || project.designs.some((design) => design.id === cardAction.id)) return state;
    const active = project.designs.find((item) => item.id === project.activeId)!;
    const blank: CardDesignData = { ...active.data, artworkLayers: [], stamps: [], texts: [], backgroundColor: "#fffdf9", showFrame: false, showLines: false, frame: undefined };
    const data = cardAction.data ?? (cardAction.duplicate ? structuredClone(active.data) : blank);
    const baseName = cardAction.name ?? `デザイン${String.fromCharCode(65 + project.designs.length)}`;
    let name = baseName;
    for (let suffix = 2; project.designs.some((design) => design.name === name); suffix++) name = `${baseName.slice(0, 52)} (${suffix})`;
    const design: CardDesign = { id: cardAction.id, name, copies: 0, data, libraryId: cardAction.libraryId };
    next.designs.push(design); next.activeId = design.id;
    return { ...applyCardDesign(state, data), miniCardProject: next };
  }
  if (cardAction.type === "card-copies") {
    next.designs = next.designs.map((item) => item.id === cardAction.id ? { ...item, copies: Math.max(0, Math.min(100, Math.floor(cardAction.copies || 0))) } : item);
    next.slots = reconcileCardSlots(project.slots, next.designs, cardCapacity(state));
  }
  if (cardAction.type === "card-place") {
    if (cardAction.index < 0 || cardAction.index >= project.slots.length || (cardAction.id && !project.designs.some((item) => item.id === cardAction.id))) return state;
    next.slots = project.slots.map((id, index) => index === cardAction.index ? cardAction.id : id);
    next.designs = project.designs.map((design) => ({ ...design, copies: next.slots.filter((id) => id === design.id).length }));
  }
  if (cardAction.type === "card-rename") next.designs = project.designs.map((design) => design.id === cardAction.id ? { ...design, name: cardAction.name.slice(0, 60) } : design);
  if (cardAction.type === "card-library-id") next.designs = project.designs.map((design) => design.id === cardAction.id ? { ...design, libraryId: cardAction.libraryId } : design);
  return { ...state, miniCardProject: next };
}
export function allRuntimeDesignAssets(state: AppState) { return [...state.artworkLayers, ...state.stamps, ...(state.miniCardProject?.designs.flatMap((design) => [...design.data.artworkLayers, ...design.data.stamps]) ?? [])]; }
