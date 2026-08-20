import type { AppAction, AppState } from "./app-types";

export const DEFAULT_DIELINE_LINE_COLORS = {
  cut: "#a69888",
  fold: "#c3b7a8",
};

function moveItem<T extends { id: string; pageId?: string }>(items: T[], id: string, direction: "forward" | "backward") {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const step = direction === "forward" ? 1 : -1;
  let target = index + step;
  while (target >= 0 && target < items.length && items[target].pageId !== items[index].pageId) target += step;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const initialState: AppState = {
  screen: "home",
  box: {
    type: "straight-tuck-carton-v1",
    widthMm: 40,
    depthMm: 25,
    heightMm: 60,
    paperThicknessMm: 0.27,
    glueFlapMm: 12,
    lidDepthMm: 40,
    lidClearanceMm: 0.6,
    foldoverMm: 25,
  },
  activePageId: "main",
  backgroundColors: { main: "#fffdf9", lid: "#fffdf9", base: "#fffdf9" },
  artworkLayers: [],
  stamps: [],
  selectedArtworkId: null,
  selectedStampId: null,
  texts: [],
  selectedTextId: null,
  openEditorSection: "artwork",
  showGuides: true,
  lineColors: DEFAULT_DIELINE_LINE_COLORS,
  includeCalibrationPage: true,
  printFoldoverLines: true,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "replace-state":
      return action.state;
    case "go":
      return { ...state, screen: action.screen, selectedArtworkId: null, selectedStampId: null, selectedTextId: null };
    case "set-box-type":
      return {
        ...state,
        box: action.boxType === "two-piece-gift-box-v1"
          ? {
              ...state.box,
              type: action.boxType,
              widthMm: 100,
              heightMm: 75,
              depthMm: 40,
              paperThicknessMm: 0.4,
              glueFlapMm: 12,
              lidDepthMm: 40,
              lidClearanceMm: 0.6,
              foldoverMm: 25,
            }
          : { ...state.box, type: action.boxType },
        activePageId: action.boxType === "two-piece-gift-box-v1" ? "lid" : "main",
        selectedArtworkId: null,
        selectedStampId: null,
        selectedTextId: null,
      };
    case "replace-box":
      return {
        ...state,
        box: { ...action.box },
        activePageId: action.box.type === "two-piece-gift-box-v1" ? "lid" : "main",
        selectedArtworkId: null,
        selectedStampId: null,
        selectedTextId: null,
      };
    case "set-active-page":
      return { ...state, activePageId: action.pageId, selectedArtworkId: null, selectedStampId: null, selectedTextId: null };
    case "update-box":
      return {
        ...state,
        box: {
          ...state.box,
          [action.field]: action.value,
          ...(action.field === "depthMm"
            && state.box.type === "two-piece-gift-box-v1"
            && (state.box.lidDepthMm ?? state.box.depthMm) > action.value
            ? { lidDepthMm: action.value }
            : {}),
        },
      };
    case "set-background-color":
      return { ...state, backgroundColors: { ...state.backgroundColors, [action.pageId]: action.color } };
    case "replace-page-background":
      return {
        ...state,
        backgroundColors: {
          ...state.backgroundColors,
          [action.targetPageId]: state.backgroundColors[action.sourcePageId],
        },
        artworkLayers: [
          ...state.artworkLayers.filter((item) => item.pageId !== action.targetPageId),
          ...action.items.map((item) => ({ ...item, pageId: action.targetPageId })),
        ],
        selectedArtworkId: null,
        selectedStampId: null,
        selectedTextId: null,
      };
    case "add-artwork":
      return { ...state, artworkLayers: [...state.artworkLayers, action.item], selectedArtworkId: action.item.id, selectedStampId: null, selectedTextId: null };
    case "select-artwork":
      return { ...state, selectedArtworkId: action.id, selectedStampId: null, selectedTextId: null };
    case "update-artwork":
      return { ...state, artworkLayers: state.artworkLayers.map((item) => item.id === action.id ? { ...item, ...action.patch } as typeof item : item) };
    case "remove-artwork":
      return { ...state, artworkLayers: state.artworkLayers.filter((item) => item.id !== action.id), selectedArtworkId: state.selectedArtworkId === action.id ? null : state.selectedArtworkId };
    case "duplicate-artwork": {
      const source = state.artworkLayers.find((item) => item.id === action.id);
      if (!source) return state;
      const copy = { ...source, id: action.newId, name: `${source.name} コピー`, offsetXmm: source.offsetXmm + 3, offsetYmm: source.offsetYmm + 3 } as typeof source;
      return { ...state, artworkLayers: [...state.artworkLayers, copy], selectedArtworkId: copy.id, selectedStampId: null, selectedTextId: null };
    }
    case "move-artwork":
      return { ...state, artworkLayers: moveItem(state.artworkLayers, action.id, action.direction) };
    case "add-stamp":
      return { ...state, stamps: [...state.stamps, action.item], selectedArtworkId: null, selectedStampId: action.item.id, selectedTextId: null };
    case "select-stamp":
      return { ...state, selectedArtworkId: null, selectedStampId: action.id, selectedTextId: null };
    case "update-stamp":
      return { ...state, stamps: state.stamps.map((item) => item.id === action.id ? { ...item, ...action.patch } : item) };
    case "remove-stamp":
      return { ...state, stamps: state.stamps.filter((item) => item.id !== action.id), selectedStampId: state.selectedStampId === action.id ? null : state.selectedStampId };
    case "duplicate-stamp": {
      const source = state.stamps.find((item) => item.id === action.id);
      if (!source) return state;
      const copy = { ...source, id: action.newId, name: `${source.name} コピー`, xMm: source.xMm + 3, yMm: source.yMm + 3 };
      return { ...state, stamps: [...state.stamps, copy], selectedArtworkId: null, selectedStampId: copy.id, selectedTextId: null };
    }
    case "move-stamp":
      return { ...state, stamps: moveItem(state.stamps, action.id, action.direction) };
    case "add-text":
      return { ...state, texts: [...state.texts, action.item], selectedArtworkId: null, selectedStampId: null, selectedTextId: action.item.id };
    case "select-text":
      return { ...state, selectedArtworkId: null, selectedStampId: null, selectedTextId: action.id };
    case "update-text":
      return {
        ...state,
        texts: state.texts.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item)),
      };
    case "remove-text":
      return {
        ...state,
        texts: state.texts.filter((item) => item.id !== action.id),
        selectedTextId: state.selectedTextId === action.id ? null : state.selectedTextId,
      };
    case "toggle-guides":
      return { ...state, showGuides: !state.showGuides };
    case "set-open-editor-section":
      return { ...state, openEditorSection: action.section };
    case "set-line-color":
      return { ...state, lineColors: { ...state.lineColors, [action.layer]: action.color } };
    case "set-line-colors":
      return { ...state, lineColors: action.colors };
    case "set-calibration":
      return { ...state, includeCalibrationPage: action.value };
    case "set-print-foldover-lines":
      return { ...state, printFoldoverLines: action.value };
    default:
      return state;
  }
}
