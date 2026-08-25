import type { DielineGeometry } from "../../domain/boxes/types";
import { layoutBackgrounds } from "./background-layout";
import { elementRole, targetIncludesRole } from "./element-roles";
import { clearLogoStyling, applyLogoStyling } from "./logo-styling";
import { scoreLayout } from "./layout-scoring";
import { createSeededRandom, hashSeed } from "./seeded-random";
import { layoutStamps } from "./stamp-layout";
import { stylePreset } from "./style-presets";
import { fitTextsToSafeArea, layoutTexts } from "./text-layout";
import type { AutoLayoutResult, AutoLayoutSettings, LayoutDesign } from "./types";

type AutoLayoutInput = {
  geometry: DielineGeometry;
  design: LayoutDesign;
  settings: AutoLayoutSettings;
  seed: string | number;
  previousSignature?: string | null;
};

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

export function layoutSignature(design: LayoutDesign) {
  return [
    ...design.artworkLayers.map((item) => item.kind === "uploaded-artwork"
      ? `${item.id}:${rounded(item.offsetXmm)},${rounded(item.offsetYmm)},${rounded(item.widthMm)},${item.rotationDeg},${rounded(item.repeatGapMm)}`
      : item.kind === "dot-pattern"
        ? `${item.id}:${rounded(item.offsetXmm)},${rounded(item.offsetYmm)},${rounded(item.dotDiameterMm)},${rounded(item.spacingMm)},${rounded(item.angleDeg)}`
        : `${item.id}:${rounded(item.offsetXmm)},${rounded(item.offsetYmm)},${rounded(item.stripeWidthMm)},${rounded(item.gapMm)},${item.angleDeg}`),
    ...design.stamps.map((item) => `${item.id}:${rounded(item.xMm)},${rounded(item.yMm)},${rounded(item.widthMm)},${rounded(item.rotationDeg)}`),
    ...design.texts.map((item) => `${item.id}:${rounded(item.xMm)},${rounded(item.yMm)},${rounded(item.fontSizeMm)},${rounded(item.letterSpacingMm)},${item.alignment},${item.role}`),
  ].join("|");
}

function generateCandidate(input: AutoLayoutInput, candidateSeed: number): LayoutDesign {
  const preset = stylePreset(input.settings.taste);
  const random = createSeededRandom(candidateSeed);
  let artworkLayers = input.design.artworkLayers;
  let stamps = input.design.stamps;
  let texts = input.design.texts;
  if (targetIncludesRole(input.settings.target, "background")) {
    artworkLayers = layoutBackgrounds(artworkLayers, input.geometry, preset, input.settings, random);
  }
  if (targetIncludesRole(input.settings.target, "stamp")) {
    stamps = layoutStamps(stamps, input.geometry, preset, input.settings, random);
  }
  if (targetIncludesRole(input.settings.target, "text") || targetIncludesRole(input.settings.target, "logoText")) {
    texts = layoutTexts(texts, input.geometry, preset, input.settings, random, stamps);
    texts = input.settings.logoEnabled
      ? applyLogoStyling(texts, input.settings.taste, random)
      : clearLogoStyling(texts);
    texts = fitTextsToSafeArea(texts, input.geometry, preset);
  }
  return { artworkLayers, stamps, texts };
}

export function autoLayoutElementCount(design: LayoutDesign, target: AutoLayoutSettings["target"]) {
  return [...design.artworkLayers, ...design.stamps, ...design.texts]
    .filter((item) => targetIncludesRole(target, elementRole(item)))
    .filter((item) => "visible" in item ? item.visible : item.text.trim())
    .length;
}

export function arrangeDesign(input: AutoLayoutInput): AutoLayoutResult {
  const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
  const totalElements = autoLayoutElementCount(input.design, "all");
  const candidateCount = input.settings.target === "all" ? (totalElements > 30 ? 30 : 40) : (totalElements > 30 ? 10 : 16);
  const baseSeed = hashSeed(input.seed);
  const preset = stylePreset(input.settings.taste);
  const candidates = Array.from({ length: candidateCount }, (_, index) => {
    const candidateSeed = hashSeed(baseSeed + Math.imul(index + 1, 0x9e3779b1));
    const design = generateCandidate(input, candidateSeed);
    const signature = layoutSignature(design);
    const score = scoreLayout(input.geometry, design, input.settings, preset);
    const diversityPenalty = input.previousSignature && signature === input.previousSignature ? 16 : 0;
    return { design, signature, score: { ...score, total: Math.max(0, score.total - diversityPenalty) }, candidateSeed };
  });
  const accepted = candidates.filter((candidate) => candidate.score.meetsThreshold && candidate.signature !== input.previousSignature);
  const pool = accepted.length ? accepted : candidates.filter((candidate) => candidate.signature !== input.previousSignature);
  const winner = (pool.length ? pool : candidates).sort((a, b) => b.score.total - a.score.total)[0];
  const finishedAt = typeof performance === "undefined" ? Date.now() : performance.now();
  return {
    ...winner.design,
    score: winner.score,
    seed: winner.candidateSeed,
    signature: winner.signature,
    candidateCount,
    elapsedMs: Math.max(0, finishedAt - startedAt),
  };
}
