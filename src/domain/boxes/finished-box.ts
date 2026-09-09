import { generateDielineDocument } from './registry';
import type { BoxInput, DielineGeometry, DielinePageId, Panel } from './types';

export type Vec3 = [number, number, number];
export type BoxView = 'front-angle' | 'back-angle' | 'top' | 'front';
export type Face = { name: 'front' | 'back' | 'left' | 'right' | 'top'; panel: Panel; geometry: DielineGeometry; pageId: DielinePageId; origin: Vec3; u: Vec3; v: Vec3 };
export const isPreviewBox = (type: BoxInput['type']) => ['straight-tuck-carton-v1', 'gift-box-v1', 'two-piece-gift-box-v1'].includes(type);

/** Source panel axes mapped onto the outside of the folded box. Y points down. */
export function finishedBoxFaces(input: BoxInput): Face[] {
  if (!isPreviewBox(input.type)) return [];
  const pages = generateDielineDocument(input).pages;
  const faces: Face[] = [];
  const add = (pageId: DielinePageId, id: string | Panel, name: Face['name'], origin: Vec3, u: Vec3, v: Vec3) => {
    const page = pages.find(p => p.id === pageId)!;
    const panel = typeof id === 'string' ? page.geometry.panels.find(p => p.id === id)! : id;
    if (!panel) throw new Error(`完成面が見つかりません: ${id}`);
    faces.push({ name, panel, geometry: page.geometry, pageId, origin, u, v });
  };
  if (input.type === 'straight-tuck-carton-v1') {
    const w = input.widthMm, d = input.depthMm, h = input.heightMm;
    add('main', 'panel-0', 'front', [0,0,0], [w,0,0], [0,h,0]);
    add('main', 'panel-1', 'right', [w,0,0], [0,0,d], [0,h,0]);
    add('main', 'panel-2', 'back', [w,0,d], [-w,0,0], [0,h,0]);
    add('main', 'panel-3', 'left', [0,0,d], [0,0,-d], [0,h,0]);
    const g = pages[0].geometry;
    const depth = d + input.paperThicknessMm;
    add('main', { id: 'top-cover', label: '上面', x: input.glueFlapMm, y: g.bodyTopMm-depth, width:w, height:depth }, 'top', [0,0,d], [w,0,0], [0,0,-d]);
  } else if (input.type === 'gift-box-v1') {
    // This net's broad faces use width × height; depth is the assembled thickness.
    const w = input.heightMm, d = input.widthMm, h = input.depthMm;
    add('main', 'panel-front-wall', 'front', [0,h,0], [0,-h,0], [w,0,0]);
    add('main', 'panel-rear-wall', 'back', [0,0,d], [0,h,0], [w,0,0]);
    add('main', 'panel-side-left', 'left', [0,0,d], [0,0,-d], [0,h,0]);
    add('main', 'panel-side-right', 'right', [w,h,d], [0,0,-d], [0,-h,0]);
    add('main', 'panel-lid', 'top', [0,0,0], [0,0,d], [w,0,0]);
  } else {
    const baseDepth = input.depthMm, lidDepth = input.lidDepthMm ?? baseDepth;
    const totalHeight = Math.max(baseDepth, lidDepth);
    for (const part of ['base','lid'] as const) {
      const page = pages.find(p => p.id === part)!;
      const center = page.geometry.panels.find(p => p.id === `${part}-center`)!;
      const w = center.width, d = center.height, h = part === 'lid' ? lidDepth : baseDepth;
      const lidCenter = pages[0].geometry.panels[0];
      const x = (lidCenter.width-w)/2, z = (lidCenter.height-d)/2;
      const y = part === 'lid' ? 0 : totalHeight;
      const dy = part === 'lid' ? h : -h;
      add(part, `${part}-bottom-wall`, 'front', [x,y,z], [w,0,0], [0,dy,0]);
      add(part, `${part}-top-wall`, 'back', [x,y+dy,z+d], [w,0,0], [0,-dy,0]);
      add(part, `${part}-right-wall`, 'right', [x+w,y,z+d], [0,dy,0], [0,0,-d]);
      add(part, `${part}-left-wall`, 'left', [x,y+dy,z+d], [0,-dy,0], [0,0,-d]);
      if (part === 'lid') add(part, center, 'top', [x,0,z+d], [w,0,0], [0,0,-d]);
    }
  }
  return faces;
}

export function projectBoxPoint([x,y,z]: Vec3, view: BoxView): [number,number] {
  if (view === 'top') return [x,-z];
  if (view === 'front') return [x,y];
  // Isometric camera: yaw 45°, elevation atan(1 / sqrt(2)). All three
  // axes share a scale; parallel edges never converge or widen with depth.
  const horizontal = Math.SQRT1_2;
  const slope = 1 / Math.sqrt(6);
  const vertical = Math.sqrt(2 / 3);
  if (view === 'back-angle') return [-(x+z)*horizontal,y*vertical-x*slope+z*slope];
  return [(x+z)*horizontal,y*vertical+x*slope-z*slope];
}

export function visibleBoxFaces(faces: Face[], view: BoxView) {
  return faces.filter(f => view === 'top' ? f.name === 'top' : view === 'front' ? f.name === 'front' : view === 'back-angle' ? ['back','left','top'].includes(f.name) : ['front','right','top'].includes(f.name));
}

export function faceMatrix(face: Face, view: BoxView) {
  // The face-on view keeps the lid's exact net orientation and coordinates,
  // so users can compare stamp positions directly without a camera rotation.
  if (view === 'top') return [1,0,0,1,0,0];
  const p = projectBoxPoint(face.origin, view);
  const u = projectBoxPoint(face.u, view), v = projectBoxPoint(face.v, view);
  return [u[0]/face.panel.width,u[1]/face.panel.width,v[0]/face.panel.height,v[1]/face.panel.height,p[0],p[1]];
}
