import { describe, expect, it } from "vitest";

import {
  buildUIEditorStyles,
  emptyUIEditorConfig,
  sanitizeUIEditorConfig,
  updateComponentPatch,
  withoutComponentPatch,
  withoutScreenPatches,
} from "@usapon/ui-editor/runtime";
import { shouldCloseEditorSheet } from "@usapon/ui-editor/editor";
import { PACKAGE_UI_EDITOR_REGISTRY } from "../src/ui-editor/registry";
import migration from "../supabase/migrations/202608290001_package_ui_editor.sql?raw";

describe("共通UI Editor設定", () => {
  it("編集シートは十分な下スワイプまたは速いフリックで閉じる", () => {
    expect(shouldCloseEditorSheet(72, 500)).toBe(true);
    expect(shouldCloseEditorSheet(24, 40)).toBe(true);
    expect(shouldCloseEditorSheet(40, 500)).toBe(false);
    expect(shouldCloseEditorSheet(-30, 20)).toBe(false);
  });

  it("編集対象のdata-ui-idが重複しない", () => {
    const ids = PACKAGE_UI_EDITOR_REGISTRY.targets.map((target) => target.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("スマホ・iPad・PCの値を別レイヤーとして保持する", () => {
    let config = emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId);
    config = updateComponentPatch(config, "design.canvas", "mobile", { height: 360, paddingTop: 8 });
    config = updateComponentPatch(config, "design.canvas", "tablet", { height: 540, paddingTop: 18 });
    config = updateComponentPatch(config, "design.canvas", "desktop", { height: 680 });

    expect(config.components["design.canvas"]?.mobile?.height).toBe(360);
    expect(config.components["design.canvas"]?.tablet?.height).toBe(540);
    expect(config.components["design.canvas"]?.desktop?.height).toBe(680);

    const css = buildUIEditorStyles(config);
    expect(css).toContain("@media (max-width:600px)");
    expect(css).toContain("@media (min-width:601px) and (max-width:1023px)");
    expect(css).toContain("@media (min-width:1024px)");
  });

  it("未登録パーツ・危険な値・保護パーツの非表示を破棄する", () => {
    const clean = sanitizeUIEditorConfig({
      schemaVersion: 1,
      appId: "another-app",
      components: {
        "global.header": { mobile: { hidden: true, width: 9_999_999, position: "absolute", color: "url(javascript:bad)" } },
        "unknown.target": { common: { hidden: true } },
      },
      tokens: { mobile: { fontScale: 99, mainColor: "url(bad)" } },
    }, PACKAGE_UI_EDITOR_REGISTRY);

    expect(clean.appId).toBe("package-maker");
    expect(clean.components["unknown.target"]).toBeUndefined();
    expect(clean.components["global.header"]?.mobile?.hidden).toBeUndefined();
    expect(clean.components["global.header"]?.mobile?.width).toBe(2400);
    expect(clean.components["global.header"]?.mobile?.color).toBeUndefined();
    expect(clean.tokens.mobile?.fontScale).toBe(1.6);
    expect(clean.tokens.mobile?.mainColor).toBeUndefined();
  });

  it("パーツ単位・画面単位の初期化が他の端末設定を消さない", () => {
    let config = emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId);
    config = updateComponentPatch(config, "design.canvas", "mobile", { height: 350 });
    config = updateComponentPatch(config, "design.canvas", "tablet", { height: 520 });
    config = updateComponentPatch(config, "design.controls", "tablet", { paddingTop: 12 });
    config = updateComponentPatch(config, "print.preview", "tablet", { height: 600 });

    const partReset = withoutComponentPatch(config, "design.canvas", "tablet");
    expect(partReset.components["design.canvas"]?.mobile?.height).toBe(350);
    expect(partReset.components["design.canvas"]?.tablet).toBeUndefined();

    const screenReset = withoutScreenPatches(config, PACKAGE_UI_EDITOR_REGISTRY, "design", "tablet");
    expect(screenReset.components["design.canvas"]?.mobile?.height).toBe(350);
    expect(screenReset.components["design.canvas"]?.tablet).toBeUndefined();
    expect(screenReset.components["design.controls"]).toBeUndefined();
    expect(screenReset.components["print.preview"]?.tablet?.height).toBe(600);
  });

  it("公開CSSは許可した宣言とDesign Tokenだけを生成する", () => {
    const clean = sanitizeUIEditorConfig({
      schemaVersion: 1,
      appId: "package-maker",
      tokens: { common: { mainColor: "#df6479", cardRadius: 20 } },
      components: { "letter.choice-grid": { tablet: { gridColumns: 2, gap: 12, hidden: false } } },
    }, PACKAGE_UI_EDITOR_REGISTRY);
    const css = buildUIEditorStyles(clean);
    expect(css).toContain("--ui-main-color:#df6479");
    expect(css).toContain("--ui-card-radius:20px");
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))!important");
    expect(css).not.toContain("position:");
  });

  it("明示した幅と高さは既存のレスポンシブ上限に遮られない", () => {
    const config = updateComponentPatch(emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId), "design.canvas", "mobile", { width: 360, height: 420 });
    const css = buildUIEditorStyles(config);
    expect(css).toContain("width:360px!important");
    expect(css).toContain("max-width:100%!important");
    expect(css).toContain("height:420px!important");
    expect(css).toContain("max-height:none!important");
    expect(css).toContain("flex-basis:auto!important");
  });

  it("パネル配置は親幅を超えず横並び時に自動で折り返す", () => {
    let config = emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId);
    config = updateComponentPatch(config, "design.canvas", "tablet", { width: 420, horizontalPosition: "right" });
    config = updateComponentPatch(config, "design.workspace", "tablet", { flexDirection: "row", flexWrap: "wrap", gap: 12 });
    const css = buildUIEditorStyles(config);

    expect(css).toContain("max-width:100%!important");
    expect(css).toContain("margin-left:auto!important");
    expect(css).toContain("margin-right:0!important");
    expect(css).toContain("flex-wrap:wrap!important");
  });

  it("重なりを招く負の外側余白を保存しない", () => {
    const clean = sanitizeUIEditorConfig({
      schemaVersion: 1,
      appId: "package-maker",
      components: { "design.canvas": { tablet: { marginTop: -80, marginLeft: -30 } } },
    }, PACKAGE_UI_EDITOR_REGISTRY);

    expect(clean.components["design.canvas"]?.tablet?.marginTop).toBe(0);
    expect(clean.components["design.canvas"]?.tablet?.marginLeft).toBe(0);
  });
});

describe("UI EditorのDB権限境界", () => {
  it("管理者判定をAuth UIDでサーバー側実行する", () => {
    expect(migration).toContain("user_id uuid primary key references auth.users(id)");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("security definer");
    expect(migration).not.toMatch(/gmail\.com/i);
  });

  it("一般ユーザーへテーブルや編集RPCを公開しない", () => {
    expect(migration).toContain("revoke all on table package.ui_editor_admins from public, anon, authenticated");
    expect(migration).toContain("revoke all on table package.ui_editor_configs from public, anon, authenticated");
    expect(migration).not.toContain("grant execute on function package.save_ui_editor_draft(text, jsonb, integer) to anon");
    expect(migration).toContain("grant execute on function package.get_published_ui_config(text) to anon, authenticated, service_role");
  });

  it("Draft・Published・Previousと楽観ロックを保持する", () => {
    expect(migration).toContain("draft jsonb not null");
    expect(migration).toContain("published jsonb not null");
    expect(migration).toContain("previous jsonb");
    expect(migration).toContain("revision = p_expected_revision");
    expect(migration).toContain("previous = published");
    expect(migration).toContain("published = previous");
  });
});
