import type { DielineGeometry, Point } from './types';

export type FoldEdge = 'top' | 'bottom' | 'left' | 'right';
export type FoldRect = { x: number; y: number; width: number; height: number };
/** A piece of the net that is hinged to the front face and folds behind it. Coordinates are net millimetres. */
export type FoldPart = {
  id: string;
  points: Point[];
  box: FoldRect;
  edge: FoldEdge;
  /** The front face edge it hinges on, as a coordinate on the folding axis (y for top and bottom, x for left and right). */
  hinge: number;
  /** Stacking order once folded: higher parts lie on top of lower ones. */
  layer: number;
  /** The closing flap can be opened; every other piece stays folded. */
  isFlap: boolean;
};

const boundsOf = (points: Point[]): FoldRect => {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

/**
 * How an envelope net folds into the finished envelope: the front face stays put and the rest hinges onto it.
 * The kamasu net folds its back panel up from the bottom; the diamond net folds both side flaps and the bottom flap.
 */
export function envelopeFoldParts(geometry: DielineGeometry): { front: FoldRect; parts: FoldPart[] } {
  const polygon = (id: string) => geometry.clipPolygons.find(p => p.id === id);
  const frontPolygon = polygon('envelope-front');
  if (!frontPolygon) throw new Error('封筒の表面が見つかりません');
  const front = boundsOf(frontPolygon.points);
  const part = (id: string, edge: FoldEdge, layer: number, isFlap = false): FoldPart[] => {
    const shape = polygon(id);
    if (!shape) return [];
    const hinge = edge === 'top' ? front.y : edge === 'bottom' ? front.y + front.height : edge === 'left' ? front.x : front.x + front.width;
    return [{ id, points: shape.points, box: boundsOf(shape.points), edge, hinge, layer, isFlap }];
  };
  const parts = geometry.envelope?.construction === 'kamasu'
    ? [...part('envelope-back', 'bottom', 0), ...part('envelope-top-flap', 'top', 1, true)]
    : [...part('envelope-left-flap', 'left', 0), ...part('envelope-right-flap', 'right', 0), ...part('envelope-bottom-flap', 'bottom', 1), ...part('envelope-top-flap', 'top', 2, true)];
  return { front, parts };
}

/** CSS rotation that folds a piece behind the front face about its hinge. 180° lays it flat on the back. */
export function foldRotation(edge: FoldEdge, degrees: number): string {
  // rotateX(+) swings a piece above the hinge backwards, rotateX(-) one below it; rotateY works the same way for the sides.
  if (edge === 'top') return `rotateX(${degrees}deg)`;
  if (edge === 'bottom') return `rotateX(${-degrees}deg)`;
  return `rotateY(${edge === 'right' ? degrees : -degrees}deg)`;
}
