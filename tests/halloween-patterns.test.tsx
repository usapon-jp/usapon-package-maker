import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState } from "../src/app/app-state";
import { builtInStampForKey, createRepeatingArtwork, isBuiltInStampPickerVisible, markAsBuiltInStamp } from "../src/app/artwork";
import { hydrateBoxDocument, serializeBoxDocument } from "../src/app/box-document";
import { A4ExportSvg } from "../src/components/dieline/A4ExportSvg";
import { generateDielineDocument } from "../src/domain/boxes/registry";
import { evaluateA4Fit } from "../src/domain/paper/a4";
import { HALLOWEEN_PATTERNS } from "../src/features/templates/halloween-patterns";

describe("ハロウィン総柄", () => {
  it.each(HALLOWEEN_PATTERNS)("$name を画像アップロードなしで保存・復元して印刷できる", async (preset) => {
    expect(isBuiltInStampPickerVisible(builtInStampForKey(preset.key))).toBe(false);
    const geometry = generateDielineDocument(initialState.box).pages[0].geometry;
    const item = createRepeatingArtwork(markAsBuiltInStamp({
      id: crypto.randomUUID(), fileName: preset.fileName, sourceType: "png",
      dataUrl: "data:image/png;base64,AA==", aspectRatio: 1,
    }, preset.key), geometry);
    item.name = preset.name;
    const document = serializeBoxDocument({ ...initialState, artworkLayers: [item] });
    expect(JSON.stringify(document)).not.toContain("data:image");
    const restored = await hydrateBoxDocument(document, async (ref) => {
      expect(ref).toEqual({ kind: "builtin", key: preset.key });
      return { dataUrl: item.dataUrl };
    });
    expect(restored.artworkLayers[0]).toMatchObject({
      name: preset.name, repeat: true, repeatGapMm: 0, widthMm: 80,
      assetRef: { kind: "builtin", key: preset.key },
    });
    const markup = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm)}
      backgroundColor={restored.backgroundColors.main} artworkLayers={restored.artworkLayers}
      stamps={[]} texts={[]} lineColors={restored.lineColors} />);
    expect(markup).toContain('<pattern');
    expect(markup).toContain(item.dataUrl);
  });
});
