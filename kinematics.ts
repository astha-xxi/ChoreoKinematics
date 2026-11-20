import type { Point3, PoseFrame } from "../types";

export const POSE = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12, LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16, LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26, LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30, LEFT_FOOT: 31, RIGHT_FOOT: 32
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sub = (a: Point3, b: Point3) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
const dot = (a: Point3, b: Point3) => a.x*b.x + a.y*b.y + a.z*b.z;
const norm = (a: Point3) => Math.sqrt(dot(a,a));
export function angle(a: Point3, vertex: Point3, c: Point3): number {
  const u = sub(a, vertex), v = sub(c, vertex);
  const denom = norm(u) * norm(v);
  if (!denom) return 0;
  return Math.acos(clamp(dot(u,v)/denom, -1, 1)) * 180 / Math.PI;
}
export function jointMetrics(points: Point3[]) {
  if (points.length < 33) return null;
  const leftKnee = angle(points[POSE.LEFT_HIP], points[POSE.LEFT_KNEE], points[POSE.LEFT_ANKLE]);
  const rightKnee = angle(points[POSE.RIGHT_HIP], points[POSE.RIGHT_KNEE], points[POSE.RIGHT_ANKLE]);
  const leftElbow = angle(points[POSE.LEFT_SHOULDER], points[POSE.LEFT_ELBOW], points[POSE.LEFT_WRIST]);
  const rightElbow = angle(points[POSE.RIGHT_SHOULDER], points[POSE.RIGHT_ELBOW], points[POSE.RIGHT_WRIST]);
  const hipMid = midpoint(points[POSE.LEFT_HIP], points[POSE.RIGHT_HIP]);
  const shoulderMid = midpoint(points[POSE.LEFT_SHOULDER], points[POSE.RIGHT_SHOULDER]);
  const ankleMid = midpoint(points[POSE.LEFT_ANKLE], points[POSE.RIGHT_ANKLE]);
  const shoulderTilt = Math.atan2(points[POSE.RIGHT_SHOULDER].y-points[POSE.LEFT_SHOULDER].y,
    points[POSE.RIGHT_SHOULDER].x-points[POSE.LEFT_SHOULDER].x) * 180 / Math.PI;
  const hipTilt = Math.atan2(points[POSE.RIGHT_HIP].y-points[POSE.LEFT_HIP].y,
    points[POSE.RIGHT_HIP].x-points[POSE.LEFT_HIP].x) * 180 / Math.PI;
  const com = { x: hipMid.x*.55 + shoulderMid.x*.3 + ankleMid.x*.15,
    y: hipMid.y*.55 + shoulderMid.y*.3 + ankleMid.y*.15,
    z: hipMid.z*.55 + shoulderMid.z*.3 + ankleMid.z*.15 };
  const supportCenter = midpoint(points[POSE.LEFT_ANKLE], points[POSE.RIGHT_ANKLE]);
  const stabilityProxy = Math.hypot(com.x-supportCenter.x, com.z-supportCenter.z);
  return { leftKnee, rightKnee, leftElbow, rightElbow, shoulderTilt, hipTilt, stabilityProxy, com,
    leftExtension: Math.abs(points[POSE.LEFT_WRIST].y-points[POSE.LEFT_HIP].y),
    rightExtension: Math.abs(points[POSE.RIGHT_WRIST].y-points[POSE.RIGHT_HIP].y) };
}
function midpoint(a: Point3,b: Point3): Point3 { return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2}; }

// Local polynomial least-squares smoother. A compact quadratic fit is evaluated at
// the center sample; edge windows are shortened. This reduces jitter without
// introducing the lag of a moving average.
function solve3(m: number[][], b: number[]): number[] {
  const a = m.map((r,i)=>[...r,b[i]]);
  for(let i=0;i<3;i++){
    let pivot=i; for(let r=i+1;r<3;r++) if(Math.abs(a[r][i])>Math.abs(a[pivot][i])) pivot=r;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    const d=a[i][i] || 1e-9; for(let j=i;j<4;j++) a[i][j]/=d;
    for(let r=0;r<3;r++) if(r!==i){const f=a[r][i];for(let j=i;j<4;j++)a[r][j]-=f*a[i][j];}
  }
  return [a[0][3],a[1][3],a[2][3]];
}
export function smoothFrames(frames: PoseFrame[], windowSize=5): PoseFrame[] {
  if(frames.length<3) return frames;
  const half=Math.floor(windowSize/2);
  return frames.map((frame,i)=>({
    timestamp:frame.timestamp,
    landmarks:frame.landmarks.map((p,k)=>{
      const start=Math.max(0,i-half), end=Math.min(frames.length-1,i+half);
      const samples=frames.slice(start,end+1).map((f,j)=>({t:start+j-i,p:f.landmarks[k]}));
      const fit=(axis:"x"|"y"|"z")=>{
        let s0=0,s1=0,s2=0,s3=0,s4=0,b0=0,b1=0,b2=0;
        samples.forEach(({t,p})=>{const v=p[axis];s0++;s1+=t;s2+=t*t;s3+=t*t*t;s4+=t*t*t*t;b0+=v;b1+=t*v;b2+=t*t*v;});
        const c=solve3([[s0,s1,s2],[s1,s2,s3],[s2,s3,s4]],[b0,b1,b2]);
        return c[0];
      };
      return {...p,x:fit("x"),y:fit("y"),z:fit("z")};
    })
  }));
}
export function angularVelocity(previous: number|undefined, current: number, dtMs: number) {
  return previous===undefined || dtMs<=0 ? 0 : (current-previous)/(dtMs/1000);
}
export function dtwDistance(a:number[],b:number[]):number {
  if(!a.length||!b.length) return 0;
  const prev=Array(b.length+1).fill(Infinity); prev[0]=0;
  let prior=prev;
  for(let i=1;i<=a.length;i++){
    const curr=Array(b.length+1).fill(Infinity);
    for(let j=1;j<=b.length;j++){
      curr[j]=Math.abs(a[i-1]-b[j-1])+Math.min(curr[j-1],prior[j],prior[j-1]);
    }
    prior=curr;
  }
  return prior[b.length]/(a.length+b.length);
}
export function sequenceFeature(frames:PoseFrame[]):number[] {
  return smoothFrames(frames).map(f=>jointMetrics(f.landmarks)?.leftKnee ?? 0);
}
