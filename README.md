# ChoreoKinematics

A privacy-first, browser-based dance rehearsal and formation studio built with React, TypeScript, Three.js, and MediaPipe Pose Landmarker.

## Current implementation

- Live webcam pose tracking with MediaPipe's 33 body landmarks and world landmarks.
- Local-only pose processing. Camera frames are processed in the browser; this app does not upload video.
- 3D skeleton and floor-plane view rendered with Three.js.
- Joint-angle measurements, a Savitzky–Golay-style local polynomial smoother, approximate center-of-mass proxy, and angular-velocity estimate.
- Record a short reference sequence and compare a later performance using Dynamic Time Warping (DTW).
- Load an audio file, start/stop playback, estimate beat accents from waveform energy, and show a visual beat cue.
- Stage formation editor with draggable dancer markers, audience-view preview, spacing warnings, and local formation save/load.
- Accessibility settings: high-contrast visual beat flash and optional sonification of a selected joint height.
- Export/import anonymized landmark sequences as JSON.

## Important limitations (read before using for assessment)

This is a substantial working prototype, not a validated biomechanical measurement system.
- A single RGB camera cannot reliably recover true 3D body geometry or anatomical joint centers. MediaPipe world landmarks are model estimates, not laboratory-grade motion capture.
- Turnout, extension, balance, and symmetry scores are coaching indicators, not medical or injury-risk assessments. Camera angle, clothing, occlusion, and calibration affect them.
- The center-of-mass value is a rough weighted landmark proxy, not a full-body inertial model.
- Beat detection is a lightweight onset/energy heuristic. Browser timing, audio-device latency, and camera inference latency mean millisecond-accurate synchronization is not guaranteed.
- DTW compares the selected scalar motion feature over time; it is not a complete expert assessment of dance quality.
- Formation collision checks use 2D stage-plane distances and simplified dancer radii. They do not simulate full-body motion or guarantee collision-free choreography.
- The current app focuses on live camera sessions. Uploaded-video pose extraction and multi-camera capture are not implemented.

## Run locally

Requirements: Node.js 18+ and a modern browser with webcam support.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Allow camera access when prompted. MediaPipe's model and WASM assets are fetched from Google's public MediaPipe CDN on first use; pose inference itself runs in the browser. For a fully offline deployment, download and self-host those assets and update `src/lib/pose.ts`.

For a production build:

```bash
npm run build
npm run preview
```

## Privacy

- Webcam frames are passed directly to the local MediaPipe task in the browser.
- Raw video is not sent to a server by this app.
- Saved reference/formation data stays in browser `localStorage` unless you explicitly export it.
- JSON exports contain landmark coordinates and timestamps, not video or audio.
- Audio files are decoded locally by the browser's Web Audio API.

Use a device you control, avoid recording other dancers without informed permission, and delete local session data on shared devices.

## Suggested next development steps

1. Add a calibration flow for camera placement and dancer height.
2. Add video-file decoding and frame-by-frame pose extraction locally.
3. Improve beat tracking with a tempo grid and explicit latency calibration.
4. Add full 3D inverse-kinematics constraints and validated segment-length normalization.
5. Conduct consent-based usability testing with instructors and dancers; report only measured outcomes.
6. Validate all scoring against qualified dance educators and appropriate research protocols.

## License

MIT. See `LICENSE`.
