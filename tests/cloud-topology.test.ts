import { describe, expect, it } from "vitest";

import {
  PACKAGE_BOX_ASSETS_BUCKET,
  PACKAGE_SCHEMA,
  PACKAGE_THEME_PACK_ASSETS_BUCKET,
} from "../src/cloud/supabase-client";

describe("共有Supabaseのパッケージメーカー境界", () => {
  it("DBスキーマとStorage bucketをアプリ固有名にする", () => {
    expect(PACKAGE_SCHEMA).toBe("package");
    expect(PACKAGE_BOX_ASSETS_BUCKET).toBe("package-box-assets");
    expect(PACKAGE_THEME_PACK_ASSETS_BUCKET).toBe("package-theme-pack-assets");
  });

});
