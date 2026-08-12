import type { BoxDocumentV1 } from "../app/box-document";
import type { BoxType } from "../domain/boxes/types";

export type ProjectWorkspace = {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
};

export type CloudProject = ProjectWorkspace & {
  document: BoxDocumentV1;
  createdAt: string;
};

export type CloudProjectSummary = ProjectWorkspace & {
  createdAt: string;
  boxType: BoxType;
  widthMm: number;
  depthMm: number;
  heightMm: number;
};

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
