import type { ArtworkLayer, DesignElementRole, StampItem, TextItem } from "../../app/app-types";
import type { AutoLayoutTarget } from "./types";

export const AUTO_LAYOUT_TARGET_ROLES: Record<AutoLayoutTarget, readonly DesignElementRole[]> = {
  all: ["background", "stamp", "text", "logoText"],
  background: ["background"],
  stamp: ["stamp"],
  text: ["text", "logoText"],
};

export function elementRole(item: ArtworkLayer | StampItem | TextItem): DesignElementRole {
  const runtimeItem = item as { role?: DesignElementRole; kind: string };
  if (runtimeItem.role) return runtimeItem.role;
  if (runtimeItem.kind === "stamp") return "stamp";
  if (runtimeItem.kind === "text") return "text";
  return "background";
}

export function targetIncludesRole(target: AutoLayoutTarget, role: DesignElementRole) {
  return AUTO_LAYOUT_TARGET_ROLES[target].includes(role);
}
