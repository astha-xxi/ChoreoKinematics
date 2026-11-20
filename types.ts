export type Point3 = { x: number; y: number; z: number; visibility?: number };
export type PoseFrame = { timestamp: number; landmarks: Point3[] };
export type Dancer = { id: string; name: string; x: number; z: number; color: string };
export type Formation = { id: string; name: string; dancers: Dancer[]; updatedAt: number };
