import type { BoxGenerator, BoxInput, DielineDocument } from "./types";
import { generateGiftBox } from "./gift-box";
import { generateStraightTuckCarton } from "./straight-tuck-carton";
import { generateTwoPieceGiftBox } from "./two-piece-gift-box";

const boxGenerators: Record<Exclude<BoxInput["type"], "two-piece-gift-box-v1">, BoxGenerator> = {
  "straight-tuck-carton-v1": generateStraightTuckCarton,
  "gift-box-v1": generateGiftBox,
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
    pages: [{ id: "main", label: "展開図", geometry: generateDieline(input) }],
  };
}
