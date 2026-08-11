import { describe, expect, it } from "vitest";

import { appReducer, initialState } from "../src/app/app-state";
import {
  createDotPattern,
  createStamp,
  createStripePattern,
  createUploadedArtwork,
  rotateQuarterTurn,
} from "../src/app/artwork";
import type { UploadedAsset } from "../src/app/app-types";
import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";

const geometry = generateStraightTuckCarton(initialState.box);
const asset: UploadedAsset = {
  id: "asset-1",
  fileName: "sample.png",
  sourceType: "png",
  dataUrl: "data:image/png;base64,AA==",
  aspectRatio: 2,
};

describe("背景・柄・スタンプの状態管理", () => {
  it("基本色と柄プリセットの初期値を設定する", () => {
    const stripe = createStripePattern("stripe-1", 1);
    const dots = createDotPattern("dots-1", 1);

    expect(initialState.backgroundColor).toBe("#fffdf9");
    expect(stripe).toMatchObject({ color: "#f6d96f", stripeWidthMm: 5, gapMm: 5, angleDeg: 45 });
    expect(dots).toMatchObject({ color: "#f6d96f", dotDiameterMm: 8, spacingMm: 24 });
  });

  it("背景・柄レイヤーを追加、選択、更新、複製、並べ替え、削除できる", () => {
    const stripe = createStripePattern("stripe-1", 1);
    const dots = createDotPattern("dots-1", 1);
    let state = appReducer(initialState, { type: "add-artwork", item: stripe });
    state = appReducer(state, { type: "add-artwork", item: dots });
    state = appReducer(state, { type: "update-artwork", id: dots.id, patch: { visible: false, opacity: 0.45 } });

    expect(state.selectedArtworkId).toBe(dots.id);
    expect(state.artworkLayers[1]).toMatchObject({ visible: false, opacity: 0.45 });

    state = appReducer(state, { type: "move-artwork", id: dots.id, direction: "backward" });
    expect(state.artworkLayers.map((item) => item.id)).toEqual([dots.id, stripe.id]);

    state = appReducer(state, { type: "duplicate-artwork", id: stripe.id, newId: "stripe-copy" });
    expect(state.artworkLayers.at(-1)).toMatchObject({ id: "stripe-copy", name: "ストライプ 1 コピー" });

    state = appReducer(state, { type: "remove-artwork", id: dots.id });
    expect(state.artworkLayers.map((item) => item.id)).toEqual([stripe.id, "stripe-copy"]);
  });

  it("アップロード背景とスタンプを主要面中央へ追加する", () => {
    const artwork = createUploadedArtwork(asset, geometry);
    const stamp = createStamp({ ...asset, id: "stamp-1" }, geometry, "Pofumofu friends");
    const firstPanel = geometry.panels[0];
    const expectedCenter = {
      x: firstPanel.x + firstPanel.width / 2,
      y: firstPanel.y + firstPanel.height / 2,
    };

    expect(artwork).toMatchObject({ kind: "uploaded-artwork", repeat: false, rotationDeg: 0, offsetXmm: expectedCenter.x, offsetYmm: expectedCenter.y });
    expect(stamp).toMatchObject({ kind: "stamp", name: "Pofumofu friends", rotationDeg: 0, xMm: expectedCenter.x, yMm: expectedCenter.y });
  });

  it("スタンプを追加、更新、複製、並べ替え、表示切替、削除できる", () => {
    const first = createStamp({ ...asset, id: "stamp-1" }, geometry, "1つ目");
    const second = createStamp({ ...asset, id: "stamp-2" }, geometry, "2つ目");
    let state = appReducer(initialState, { type: "add-stamp", item: first });
    state = appReducer(state, { type: "add-stamp", item: second });
    state = appReducer(state, { type: "update-stamp", id: second.id, patch: { visible: false, opacity: 0.6, rotationDeg: 90 } });

    expect(state.stamps[1]).toMatchObject({ visible: false, opacity: 0.6, rotationDeg: 90 });

    state = appReducer(state, { type: "move-stamp", id: second.id, direction: "backward" });
    expect(state.stamps.map((item) => item.id)).toEqual([second.id, first.id]);

    state = appReducer(state, { type: "duplicate-stamp", id: first.id, newId: "stamp-copy" });
    expect(state.stamps.at(-1)).toMatchObject({ id: "stamp-copy", name: "1つ目 コピー" });

    state = appReducer(state, { type: "remove-stamp", id: second.id });
    expect(state.stamps.map((item) => item.id)).toEqual([first.id, "stamp-copy"]);
  });

  it("90度ずつ回転し、蛇腹は開いている1項目だけを状態に保持する", () => {
    expect(rotateQuarterTurn(0)).toBe(90);
    expect(rotateQuarterTurn(90)).toBe(180);
    expect(rotateQuarterTurn(180)).toBe(270);
    expect(rotateQuarterTurn(270)).toBe(0);

    const stampsOpen = appReducer(initialState, { type: "set-open-editor-section", section: "stamps" });
    const textOpen = appReducer(stampsOpen, { type: "set-open-editor-section", section: "text" });
    expect(stampsOpen.openEditorSection).toBe("stamps");
    expect(textOpen.openEditorSection).toBe("text");
  });
});
