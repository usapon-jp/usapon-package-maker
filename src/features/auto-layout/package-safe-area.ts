import type { DesignElementRole } from "../../app/app-types";
import type { DielineGeometry, Line, Point, PolygonShape } from "../../domain/boxes/types";
import type { LayoutRect } from "./types";

const EPSILON = 0.0001;

export function rectArea(rect: LayoutRect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

export function intersectionArea(a: LayoutRect, b: LayoutRect) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

export function insetRect(rect: LayoutRect, inset: number): LayoutRect {
  const safeInset = Math.min(Math.max(0, inset), Math.max(0, Math.min(rect.width, rect.height) / 2 - 0.5));
  return {
    x: rect.x + safeInset,
    y: rect.y + safeInset,
    width: Math.max(1, rect.width - safeInset * 2),
    height: Math.max(1, rect.height - safeInset * 2),
  };
}

export function packagePanelRects(geometry: DielineGeometry, insetRatio = 0.1) {
  return geometry.panels
    .filter((panel) => !panel.label.includes("折り返し") && Math.min(panel.width, panel.height) >= 7)
    .map((panel) => ({
      id: panel.id,
      label: panel.label,
      rect: insetRect(
        { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
        Math.max(2.5, Math.min(panel.width, panel.height) * insetRatio),
      ),
      area: panel.width * panel.height,
    }))
    .sort((a, b) => b.area - a.area || geometry.panels.findIndex((panel) => panel.id === a.id) - geometry.panels.findIndex((panel) => panel.id === b.id));
}

export function primarySafeRect(geometry: DielineGeometry, insetRatio = 0.1): LayoutRect {
  return packagePanelRects(geometry, insetRatio)[0]?.rect ?? insetRect({
    x: 0,
    y: 0,
    width: geometry.bounds.widthMm,
    height: geometry.bounds.heightMm,
  }, 4);
}

function pointDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegmentDistance(point: Point, line: Line) {
  const dx = line.to.x - line.from.x;
  const dy = line.to.y - line.from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return pointDistance(point, line.from);
  const ratio = Math.max(0, Math.min(1, ((point.x - line.from.x) * dx + (point.y - line.from.y) * dy) / lengthSquared));
  return pointDistance(point, { x: line.from.x + ratio * dx, y: line.from.y + ratio * dy });
}

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: Point, from: Point, to: Point) {
  return point.x >= Math.min(from.x, to.x) - EPSILON
    && point.x <= Math.max(from.x, to.x) + EPSILON
    && point.y >= Math.min(from.y, to.y) - EPSILON
    && point.y <= Math.max(from.y, to.y) + EPSILON;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (Math.abs(o1) <= EPSILON && pointOnSegment(c, a, b)) return true;
  if (Math.abs(o2) <= EPSILON && pointOnSegment(d, a, b)) return true;
  if (Math.abs(o3) <= EPSILON && pointOnSegment(a, c, d)) return true;
  if (Math.abs(o4) <= EPSILON && pointOnSegment(b, c, d)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function rectCorners(rect: LayoutRect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function distanceFromPointToRect(point: Point, rect: LayoutRect) {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function rectToLineDistance(rect: LayoutRect, line: Line) {
  const corners = rectCorners(rect);
  for (let index = 0; index < corners.length; index += 1) {
    if (segmentsIntersect(corners[index], corners[(index + 1) % corners.length], line.from, line.to)) return 0;
  }
  return Math.min(
    ...corners.map((corner) => pointToSegmentDistance(corner, line)),
    distanceFromPointToRect(line.from, rect),
    distanceFromPointToRect(line.to, rect),
  );
}

function polygonLines(polygon: PolygonShape): Line[] {
  return polygon.points.map((point, index) => ({
    id: `${polygon.id}-${index}`,
    from: point,
    to: polygon.points[(index + 1) % polygon.points.length],
  }));
}

function pointInPolygon(point: Point, polygon: PolygonShape) {
  let inside = false;
  for (let current = 0, previous = polygon.points.length - 1; current < polygon.points.length; previous = current, current += 1) {
    const a = polygon.points[current];
    const b = polygon.points[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function rectTouchesPolygon(rect: LayoutRect, polygon: PolygonShape) {
  if (rectCorners(rect).some((point) => pointInPolygon(point, polygon))) return true;
  if (polygon.points.some((point) => distanceFromPointToRect(point, rect) <= EPSILON)) return true;
  const edges = polygonLines(polygon);
  return edges.some((edge) => rectToLineDistance(rect, edge) <= EPSILON);
}

function containmentScore(rect: LayoutRect, geometry: DielineGeometry) {
  const area = Math.max(1, rectArea(rect));
  return geometry.panels
    .filter((panel) => !panel.label.includes("折り返し"))
    .reduce((best, panel) => Math.max(best, intersectionArea(rect, { x: panel.x, y: panel.y, width: panel.width, height: panel.height }) / area), 0);
}

export function packageSafetyScore(geometry: DielineGeometry, rect: LayoutRect, role: DesignElementRole) {
  if (role === "background") return 1;
  const important = role === "text" || role === "logoText";
  const foldMargin = important ? 4 : 2.5;
  const cutMargin = important ? 4.5 : 3;
  const foldLines = [...geometry.layers.fold, ...geometry.layers.foldover];
  const cutLines = geometry.clipPolygons.flatMap(polygonLines);
  const foldDistance = foldLines.length ? Math.min(...foldLines.map((line) => rectToLineDistance(rect, line))) : foldMargin;
  const cutDistance = cutLines.length ? Math.min(...cutLines.map((line) => rectToLineDistance(rect, line))) : cutMargin;
  const glueTouch = geometry.layers.glue.some((polygon) => rectTouchesPolygon(rect, polygon));
  const panelContainment = containmentScore(rect, geometry);
  const bounds = { x: 0, y: 0, width: geometry.bounds.widthMm, height: geometry.bounds.heightMm };
  const boundsContainment = intersectionArea(rect, bounds) / Math.max(1, rectArea(rect));

  let score = 1;
  if (foldDistance < foldMargin) score -= (1 - foldDistance / foldMargin) * (important ? 0.48 : 0.32);
  if (cutDistance < cutMargin) score -= (1 - cutDistance / cutMargin) * (important ? 0.45 : 0.3);
  if (glueTouch) score -= important ? 0.85 : 0.55;
  if (panelContainment < 0.94) score -= (0.94 - panelContainment) * (important ? 1.15 : 0.72);
  if (boundsContainment < 1) score -= (1 - boundsContainment) * 1.5;
  return Math.max(0, Math.min(1, score));
}
