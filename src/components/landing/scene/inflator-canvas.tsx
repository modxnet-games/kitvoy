"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

import { InflatorModel, type ProgressRef } from "./inflator-model";

interface InflatorCanvasProps {
  progress: ProgressRef;
  /** Element whose pointer movement drives the parallax (the whole story section). */
  eventSource: React.RefObject<HTMLElement | null>;
  active: boolean;
  reducedMotion: boolean;
}

/** WebGL scene. Loaded client-side only (see Hero3D). */
export default function InflatorCanvas({ progress, eventSource, active, reducedMotion }: InflatorCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6.2], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "never"}
      eventSource={eventSource as React.RefObject<HTMLElement>}
      eventPrefix="client"
      shadows="percentage"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={1.2} color="#FF7A1A" />

      {/* Studio reflections generated locally, so no HDR file is downloaded */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 4, -6]} scale={[10, 2, 1]} />
        <Lightformer intensity={1.6} color="#FF7A1A" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer intensity={1.1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer intensity={0.6} position={[0, -3, 3]} rotation-x={-Math.PI / 2} scale={[8, 8, 1]} />
      </Environment>

      <InflatorModel progress={progress} reducedMotion={reducedMotion} />

      <ContactShadows position={[0, -1.45, 0]} opacity={0.45} scale={8} blur={2.6} far={3} color="#000000" />
    </Canvas>
  );
}
