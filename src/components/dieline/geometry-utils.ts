import type { Point } from "../../domain/boxes/types";

export const pointsToString = (points: Point[]) => points.map(({ x, y }) => `${x},${y}`).join(" ");
