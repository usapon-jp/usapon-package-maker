import type { BoxGenerator, BoxInput } from "./types";
import { generateGiftBox } from "./gift-box";
import { generateNStyleGiftBox } from "./n-style-gift-box";
import { generateStraightTuckCarton } from "./straight-tuck-carton";

const boxGenerators: Record<BoxInput["type"], BoxGenerator> = {
  "straight-tuck-carton-v1": generateStraightTuckCarton,
  "gift-box-v1": generateGiftBox,
  "n-style-gift-box-v1": generateNStyleGiftBox,
};

export function generateDieline(input: BoxInput) {
  return boxGenerators[input.type](input);
}
