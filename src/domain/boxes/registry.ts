import type { BoxGenerator, BoxInput } from "./types";
import { generateStraightTuckCarton } from "./straight-tuck-carton";

const boxGenerators: Record<BoxInput["type"], BoxGenerator> = {
  "straight-tuck-carton-v1": generateStraightTuckCarton,
};

export function generateDieline(input: BoxInput) {
  return boxGenerators[input.type](input);
}
