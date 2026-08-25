import type { BoxGenerator, BoxInput, DielineDocument } from "./types";
import { generateGiftBox } from "./gift-box";
import { generateStraightTuckCarton } from "./straight-tuck-carton";
import { generateTwoPieceGiftBox } from "./two-piece-gift-box";
import { generateEnvelope, generateFlatStationery } from "./stationery";

const boxGenerators: Record<Exclude<BoxInput["type"], "two-piece-gift-box-v1">, BoxGenerator> = {
  "straight-tuck-carton-v1": generateStraightTuckCarton,
  "gift-box-v1": generateGiftBox,
  "letter-paper-v1": generateFlatStationery,
  "envelope-v1": generateEnvelope,
  "mini-card-v1": generateFlatStationery,
};

export function generateDieline(input: BoxInput) {
  if (input.type === "two-piece-gift-box-v1") return generateTwoPieceGiftBox(input).pages[0].geometry;
  return boxGenerators[input.type](input);
}

export function generateDielineDocument(input: BoxInput): DielineDocument {
  if (input.type === "two-piece-gift-box-v1") return generateTwoPieceGiftBox(input);
  return {
    type: input.type,
    input,
    pages: [{ id: "main", label: input.type === "letter-paper-v1" ? "便箋" : input.type === "envelope-v1" ? "封筒の展開図" : input.type === "mini-card-v1" ? "ミニカード" : "展開図", geometry: generateDieline(input) }],
  };
}
