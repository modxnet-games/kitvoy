"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/** 0 → 1 across the pinned story (hero + 3 steps). Written by GSAP, read per frame. */
export type ProgressRef = { current: number };

const BRAND = "#f97316";
const START_PSI = 22;
const TARGET_PSI = 35;

/** Model pose at each story beat: hero, step 1, step 2, step 3. */
const POSES = [
  { rotY: -0.45, rotX: 0.12, scale: 1, y: 0 },
  // turn the hose side (+x) toward the camera for "attach the hose"
  { rotY: -1.0, rotX: -0.05, scale: 1.05, y: -0.1 },
  { rotY: 0.05, rotX: 0.04, scale: 1.32, y: -0.45 },
  { rotY: -0.35, rotX: 0.08, scale: 1.1, y: -0.1 },
] as const;

/** Below this CSS width the copy stacks under the model (matches Tailwind `lg`). */
export const STACKED_BELOW_PX = 1024;

/** Approximate model bounds (body + hose) in model units, for fitting to the stage. */
const MODEL_H = 2.9;
const MODEL_W = 2.3;
const MODEL_CENTER = { x: 0.3, y: 0.35 };

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ramp = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

function poseAt(p: number) {
  const scaled = clamp01(p) * (POSES.length - 1);
  const i = Math.min(POSES.length - 2, Math.floor(scaled));
  const t = smooth(scaled - i);
  const a = POSES[i];
  const b = POSES[i + 1];
  return {
    rotY: THREE.MathUtils.lerp(a.rotY, b.rotY, t),
    rotX: THREE.MathUtils.lerp(a.rotX, b.rotX, t),
    scale: THREE.MathUtils.lerp(a.scale, b.scale, t),
    y: THREE.MathUtils.lerp(a.y, b.y, t),
  };
}

type Readout = { value: string; label: string; color: string; inflating: boolean };

/** What the inflator's screen shows at a given story progress. */
function readoutAt(p: number): Readout {
  if (p < 1 / 6) return { value: String(TARGET_PSI), label: "PSI", color: BRAND, inflating: false };
  if (p < 0.5) return { value: String(START_PSI), label: "PSI NOW", color: "#e2e8f0", inflating: false };
  if (p < 5 / 6) {
    const v = Math.round(THREE.MathUtils.lerp(START_PSI, TARGET_PSI, ramp(p, 0.52, 0.72)));
    return { value: String(v), label: "TARGET", color: BRAND, inflating: false };
  }
  if (p < 0.97) {
    const v = Math.round(THREE.MathUtils.lerp(START_PSI, TARGET_PSI, ramp(p, 0.84, 0.96)));
    return { value: String(v), label: "FILLING", color: "#e2e8f0", inflating: true };
  }
  return { value: String(TARGET_PSI), label: "DONE ✓", color: "#4ade80", inflating: false };
}

/** Canvas texture for the LCD, redrawn only when the readout changes. */
class LcdScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private last = "";

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 512;
    this.canvas.height = 288;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  draw(r: Readout) {
    const key = `${r.value}|${r.label}|${r.color}`;
    if (key === this.last) return;
    this.last = key;
    const { canvas, ctx } = this;

    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // faint scanlines for an LCD feel
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let y = 0; y < canvas.height; y += 6) ctx.fillRect(0, y, canvas.width, 2);

    ctx.textAlign = "center";
    ctx.fillStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 24;
    ctx.font = "700 150px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    ctx.fillText(r.value, canvas.width / 2, 170);
    ctx.shadowBlur = 0;
    ctx.font = "600 44px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(226,232,240,0.75)";
    ctx.fillText(r.label, canvas.width / 2, 245);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

function useLcdScreen() {
  const lcd = useMemo(() => new LcdScreen(), []);
  useEffect(() => () => lcd.dispose(), [lcd]);
  return lcd;
}

function Hose() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.08, 0),
        new THREE.Vector3(0.04, 1.45, 0.02),
        new THREE.Vector3(0.4, 1.78, 0.08),
        new THREE.Vector3(0.88, 1.62, 0.12),
        new THREE.Vector3(1.08, 1.05, 0.16),
        new THREE.Vector3(1.02, 0.62, 0.18),
      ]),
    [],
  );
  const end = curve.getPoint(1);

  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[curve, 96, 0.055, 16, false]} />
        <meshStandardMaterial color="#111827" roughness={0.75} />
      </mesh>
      {/* brass chuck */}
      <mesh position={[end.x, end.y - 0.12, end.z]} castShadow>
        <cylinderGeometry args={[0.085, 0.085, 0.26, 24]} />
        <meshStandardMaterial color="#c9a14a" metalness={1} roughness={0.28} />
      </mesh>
      <mesh position={[end.x, end.y - 0.27, end.z]}>
        <cylinderGeometry args={[0.05, 0.06, 0.06, 20]} />
        <meshStandardMaterial color="#8a6d2f" metalness={1} roughness={0.35} />
      </mesh>
    </group>
  );
}

interface InflatorModelProps {
  progress: ProgressRef;
  /** Disable idle float, parallax and vibration. */
  reducedMotion?: boolean;
}

export function InflatorModel({ progress, reducedMotion = false }: InflatorModelProps) {
  const root = useRef<THREE.Group>(null);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const band = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.PointLight>(null);
  const lcd = useLcdScreen();
  const { viewport, pointer, size } = useThree();

  const stacked = size.width < STACKED_BELOW_PX;
  // Fit the model to the visible stage: ~62% of its height beside the copy,
  // ~48% when the copy stacks underneath.
  const fit = stacked
    ? Math.min((viewport.height * 0.48) / MODEL_H, (viewport.width * 0.8) / MODEL_W)
    : Math.min((viewport.height * 0.62) / MODEL_H, (viewport.width * 0.42) / MODEL_W);
  const baseX = (stacked ? 0 : viewport.width * 0.23) - MODEL_CENTER.x * fit;
  const baseY = (stacked ? viewport.height * 0.23 : 0) - MODEL_CENTER.y * fit;

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const p = progress.current;
    const pose = poseAt(p);
    const readout = readoutAt(p);
    lcd.draw(readout);

    const t = state.clock.elapsedTime;
    const idle = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.06;
    const parallaxY = reducedMotion ? 0 : pointer.x * 0.25;
    const parallaxX = reducedMotion ? 0 : -pointer.y * 0.12;
    const shake = readout.inflating && !reducedMotion ? Math.sin(t * 70) * 0.008 : 0;

    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, pose.rotY + parallaxY, 4, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pose.rotX + parallaxX, 4, delta);
    g.position.x = THREE.MathUtils.damp(g.position.x, baseX + shake, 5, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, baseY + pose.y * fit + idle, 4, delta);
    const s = THREE.MathUtils.damp(g.scale.x, pose.scale * fit, 4, delta);
    g.scale.setScalar(s);

    const pulse = readout.inflating ? 2.2 + Math.sin(t * 8) * 1.2 : readout.label.startsWith("DONE") ? 1.4 : 0.35;
    if (led.current) led.current.emissiveIntensity = THREE.MathUtils.damp(led.current.emissiveIntensity, pulse, 6, delta);
    if (band.current) band.current.emissiveIntensity = THREE.MathUtils.damp(band.current.emissiveIntensity, readout.inflating ? 0.9 : 0.15, 4, delta);
    if (glow.current) glow.current.intensity = THREE.MathUtils.damp(glow.current.intensity, readout.inflating ? 6 : 1.2, 4, delta);
  });

  return (
    <group ref={root} dispose={null}>
      {/* body */}
      <RoundedBox args={[1.1, 2.05, 0.62]} radius={0.2} smoothness={6} castShadow receiveShadow>
        <meshPhysicalMaterial color="#0f172a" roughness={0.32} metalness={0.25} clearcoat={1} clearcoatRoughness={0.25} />
      </RoundedBox>

      {/* orange band */}
      <RoundedBox args={[1.125, 0.12, 0.645]} radius={0.05} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial ref={band} color={BRAND} emissive={BRAND} emissiveIntensity={0.15} roughness={0.4} />
      </RoundedBox>

      {/* screen bezel + LCD */}
      <RoundedBox args={[0.86, 0.56, 0.04]} radius={0.06} smoothness={4} position={[0, 0.5, 0.305]}>
        <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.5, 0.328]}>
        <planeGeometry args={[0.76, 0.43]} />
        <meshBasicMaterial map={lcd.texture} toneMapped={false} />
      </mesh>

      {/* buttons: − power + */}
      {[-0.28, 0, 0.28].map((x) => (
        <mesh key={x} position={[x, -0.1, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[x === 0 ? 0.1 : 0.075, x === 0 ? 0.1 : 0.075, 0.05, 32]} />
          <meshStandardMaterial
            color={x === 0 ? BRAND : "#334155"}
            emissive={x === 0 ? BRAND : "#000000"}
            emissiveIntensity={x === 0 ? 0.4 : 0}
            roughness={0.35}
          />
        </mesh>
      ))}

      {/* grip ribs */}
      {[-0.45, -0.58, -0.71, -0.84].map((y) => (
        <RoundedBox key={y} args={[1.13, 0.05, 0.64]} radius={0.02} smoothness={2} position={[0, y, 0]}>
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </RoundedBox>
      ))}

      {/* top cap with LED */}
      <mesh position={[0, 1.04, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.1, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.9, 0.312]}>
        <boxGeometry args={[0.5, 0.05, 0.02]} />
        <meshStandardMaterial ref={led} color="#fff7ed" emissive="#fdba74" emissiveIntensity={0.35} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, 0.9, 0.8]} color={BRAND} intensity={1.2} distance={4} />

      <Hose />
    </group>
  );
}
