import { UIEditorShell } from "@usapon/ui-editor/editor";

import { currentUser, signInWithGoogle, signOutLocally } from "../cloud/box-repository";
import { isCloudConfigured } from "../cloud/supabase-client";
import { PACKAGE_UI_EDITOR_REGISTRY } from "./registry";
import {
  isPackageUIEditorAdmin,
  loadPackageUIEditorState,
  loadPublishedPackageUI,
  publishPackageUIEditorDraft,
  rollbackPackageUIEditorPublished,
  savePackageUIEditorDraft,
} from "./repository";

const storage = {
  isAdmin: isPackageUIEditorAdmin,
  loadState: loadPackageUIEditorState,
  loadPublished: loadPublishedPackageUI,
  saveDraft: savePackageUIEditorDraft,
  publishDraft: publishPackageUIEditorDraft,
  rollbackPublished: rollbackPackageUIEditorPublished,
};

const auth = {
  configured: isCloudConfigured,
  getUser: async () => {
    const user = await currentUser();
    if (user && window.sessionStorage.getItem("usapon-ui-editor.return") === "1") {
      window.sessionStorage.removeItem("usapon-ui-editor.return");
      const url = new URL(window.location.href);
      url.search = "?ui-edit=true";
      url.hash = "";
      window.history.replaceState(null, "", url);
    }
    return user;
  },
  signIn: signInWithGoogle,
  signOut: signOutLocally,
};

export function PackageUIEditor() {
  const preview = new URL(window.location.href);
  preview.search = "?ui-preview=true";
  preview.hash = "";
  return <UIEditorShell registry={PACKAGE_UI_EDITOR_REGISTRY} storage={storage} auth={auth} previewUrl={preview.toString()} />;
}
