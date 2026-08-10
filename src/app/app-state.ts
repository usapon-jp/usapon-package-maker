import type { AppAction, AppState } from "./app-types";

export const initialState: AppState = {
  screen: "home",
  box: {
    type: "straight-tuck-carton-v1",
    widthMm: 40,
    depthMm: 25,
    heightMm: 60,
    paperThicknessMm: 0.27,
    glueFlapMm: 12,
  },
  pattern: null,
  texts: [],
  selectedTextId: null,
  showGuides: true,
  includeCalibrationPage: true,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "go":
      return { ...state, screen: action.screen, selectedTextId: null };
    case "update-box":
      return { ...state, box: { ...state.box, [action.field]: action.value } };
    case "set-pattern":
      return { ...state, pattern: action.pattern };
    case "update-pattern":
      return state.pattern ? { ...state, pattern: { ...state.pattern, ...action.patch } } : state;
    case "add-text":
      return { ...state, texts: [...state.texts, action.item], selectedTextId: action.item.id };
    case "select-text":
      return { ...state, selectedTextId: action.id };
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
    case "set-calibration":
      return { ...state, includeCalibrationPage: action.value };
    default:
      return state;
  }
}
