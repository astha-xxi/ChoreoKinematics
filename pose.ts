import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Point3 } from "../types";

let landmarker: PoseLandmarker | null = null;
export async function getPoseLandmarker() {
  if (landmarker) return landmarker;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: false
  });
  return landmarker;
}
export function toWorldPoints(result: any): Point3[] {
  const source = result.worldLandmarks?.[0] ?? result.landmarks?.[0] ?? [];
  return source.map((p:any)=>({x:p.x,y:-p.y,z:p.z,visibility:p.visibility ?? 1}));
}
