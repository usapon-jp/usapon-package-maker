import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appReducer, initialState } from "../src/app/app-state";
import { PrintLineSettingsDialog, PrintLineSettingsControls, PrintSettingsButton } from "../src/features/letter-set/PrintLineSettings";
import { CardLayoutScreen, MiniCardPrintScreen } from "../src/features/letter-set/MiniCardStudio";
import { generateDieline } from "../src/domain/boxes/registry";
import { serializeBoxDocument } from "../src/app/box-document";
function start() { return appReducer(initialState, { type: "replace-state", state: { ...initialState, box: { ...initialState.box, type: "mini-card-v1", widthMm: 91, heightMm: 55 } } }); }
describe("印刷線の設定", () => {
  it("全カードに線色を反映し、デザイン・枚数・配置を保つ", () => {
    let state = appReducer(start(), { type: "set-background-color", pageId: "main", color: "#ffaa55" });
    state = appReducer(state, { type: "set-line-colors", colors: { cut: "#0000ff", fold: "#123456" } });
    state = appReducer(state, { type: "card-select", id: "card-b" });
    const slots = state.miniCardProject!.slots;
    const next = appReducer(state, { type: "set-print-line-colors", colors: { cut: "#ffffff", fold: "#c79a62" } });
    expect(next.lineColors).toEqual({ cut: "#ffffff", fold: "#c79a62" });
    expect(next.miniCardProject!.designs.map((design) => design.data.lineColors.cut)).toEqual(["#ffffff", "#ffffff"]);
    expect(next.miniCardProject!.slots).toEqual(slots);
    expect(next.miniCardProject!.designs[0].data.backgroundColor).toBe("#ffaa55");
    expect(state.miniCardProject!.designs[0].data.lineColors.cut).toBe("#0000ff");
    expect(serializeBoxDocument(next).design.miniCardProject!.designs[0].data.lineColors.cut).toBe("#ffffff");
  });
  it("通常の便箋や箱の印刷にも設定を適用できる", () => {
    const next = appReducer(initialState, { type: "set-print-line-colors", colors: { cut: "#c79a62", fold: "#dbc1a0" } });
    expect(next.lineColors.cut).toBe("#c79a62"); expect(next.miniCardProject).toBeUndefined();
  });
  it("白・淡いオレンジと色・コード入力を、ネイティブピッカーを開かずに選べる", () => {
    const markup = renderToStaticMarkup(<PrintLineSettingsControls state={start()} dispatch={() => undefined} />);
    expect(markup).toContain(">白</button>"); expect(markup).toContain("淡いオレンジ");
    expect(markup).toContain('aria-label="カット線のカラーコード"');
    expect(markup).toContain("すべてのカードに反映");
  });
  it("設定ダイアログは開いているときだけ表示する", () => {
    const state = start();
    expect(renderToStaticMarkup(<PrintLineSettingsDialog state={state} dispatch={() => undefined} open={false} onClose={() => undefined} />)).toBe("");
    const open = renderToStaticMarkup(<PrintLineSettingsDialog state={state} dispatch={() => undefined} open onClose={() => undefined} />);
    expect(open).toContain('role="dialog"'); expect(open).toContain('aria-label="印刷設定"'); expect(open).toContain('aria-label="閉じる"');
  });
  it("画面内の重複した設定入口を外し、最上部は歯車だけにする", () => {
    const state = start(), geometry = generateDieline(state.box), dispatch = () => undefined;
    const layout = renderToStaticMarkup(<CardLayoutScreen state={state} dispatch={dispatch} geometry={geometry} owner="device" />);
    const print = renderToStaticMarkup(<MiniCardPrintScreen state={{ ...state, screen: "print" }} dispatch={dispatch} geometry={geometry} owner="device" />);
    expect(layout).not.toContain('aria-label="印刷設定を開く"');
    expect(print).not.toContain('aria-label="印刷設定を開く"');
    const button = renderToStaticMarkup(<PrintSettingsButton onClick={() => undefined} />);
    expect(button).toContain('aria-label="印刷設定を開く"');
    expect(button).toContain('title="設定"');
    expect(button).toContain('assets/ui/settings-gear.svg');
    expect(button).toContain('aria-hidden="true"');
    expect(button).not.toContain(">設定</button>");
  });
});
