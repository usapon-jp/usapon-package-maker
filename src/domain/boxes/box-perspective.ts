import { faceMatrix, projectBoxPoint, type Face, type BoxView, type Vec3 } from './finished-box';
type Point = [number, number];
const world = (f: Face, x: number, y: number): Vec3 => f.origin.map((v,i)=>v+f.u[i]*x/f.panel.width+f.v[i]*y/f.panel.height) as Vec3;

/** One shared, centered camera for the entire box, including lid and base. */
export function boxPerspective(faces: Face[], view: BoxView) {
  const corners = faces.flatMap(f=>[world(f,0,0),world(f,f.panel.width,0),world(f,0,f.panel.height),world(f,f.panel.width,f.panel.height)]);
  const low = [0,1,2].map(i=>Math.min(...corners.map(p=>p[i])));
  const high = [0,1,2].map(i=>Math.max(...corners.map(p=>p[i])));
  const center = low.map((v,i)=>(v+high[i])/2);
  const distance = Math.max(...high.map((v,i)=>v-low[i])) * 6;
  return (f: Face, x: number, y: number): Point => {
    if(view==='top'||view==='front') {
      const [a,b,c,d,e,g]=faceMatrix(f,view);
      return [a*x+c*y+e,b*x+d*y+g];
    }
    const p=world(f,x,y).map((v,i)=>v-center[i]) as Vec3;
    const [sx,sy]=projectBoxPoint(p,view);
    const direction=view==='front-angle'?1:-1;
    const towardsCamera=(direction*(p[0]-p[2])-p[1])/Math.sqrt(3);
    const scale=distance/(distance-towardsCamera);
    return [sx*scale,sy*scale];
  };
}

/** Small affine triangles approximate the projective texture without a 3D runtime. */
export function perspectiveTriangles(f: Face, project: ReturnType<typeof boxPerspective>) {
  const result: { source: Point[]; matrix: number[] }[]=[];
  const n=8, w=f.panel.width/n, h=f.panel.height/n;
  for(let row=0;row<n;row++) for(let col=0;col<n;col++) {
    const x=col*w,y=row*h;
    const triangles: Point[][]=[[[x,y],[x+w,y],[x,y+h]],[[x+w,y+h],[x,y+h],[x+w,y]]];
    for(const source of triangles) {
      const [p,q,r]=source.map(([u,v])=>project(f,u,v));
      const [s,t,u]=source;
      const a=(q[0]-p[0])/(t[0]-s[0]), b=(q[1]-p[1])/(t[0]-s[0]);
      const c=(r[0]-p[0])/(u[1]-s[1]), d=(r[1]-p[1])/(u[1]-s[1]);
      result.push({source,matrix:[a,b,c,d,p[0]-a*s[0]-c*s[1],p[1]-b*s[0]-d*s[1]]});
    }
  }
  return result;
}
