"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TLESatellite {
  name: string;
  norad_id: number;
  approx_altitude_km: number;
  inclination_deg: number;
  mean_motion_rev_per_day: number;
}

interface OrbitGlobeProps {
  satellites?: TLESatellite[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EARTH_RADIUS = 1.0;
const KM_TO_SCENE = EARTH_RADIUS / 6371; // 1 km in scene units

// Map altitude + inclination → a stable "spread" position on a sphere shell.
// We use inclination as the polar angle and NORAD id as the azimuthal angle so
// every satellite gets a deterministic, visually distributed position.
function satellitePosition(sat: TLESatellite): THREE.Vector3 {
  const altitudeScene = sat.approx_altitude_km * KM_TO_SCENE;
  const r = EARTH_RADIUS + Math.max(altitudeScene, 0.06); // minimum visual clearance
  const phi = THREE.MathUtils.degToRad(sat.inclination_deg); // polar
  const theta = ((sat.norad_id * 137.508) % 360) * (Math.PI / 180); // golden-angle spread
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

// Colour a marker by approximate altitude (LEO→red, MEO→amber, HEO→cyan)
function markerColor(alt: number): number {
  if (alt < 400)  return 0xef4444; // red   — critical LEO
  if (alt < 600)  return 0xf59e0b; // amber — high LEO
  if (alt < 1200) return 0xfbbf24; // yellow — mid LEO
  if (alt < 2000) return 0x34d399; // green — upper LEO
  return 0x00d4ff;                  // cyan  — MEO / GEO
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function OrbitGlobe({ satellites = [], loading = false }: OrbitGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Keep Three.js state in a ref so React never triggers re-renders for it
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    earth: THREE.Mesh;
    markerGroup: THREE.Group;
    frameId: number;
    // pointer state for drag-to-rotate
    isDragging: boolean;
    lastPointer: { x: number; y: number };
    // spherical coords for camera orbit
    spherical: { theta: number; phi: number; radius: number };
  } | null>(null);

  // ── Init Three.js scene ────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      el.clientWidth / el.clientHeight,
      0.01,
      100
    );
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);

    // ── Lighting ──────────────────────────────────────────────────────────
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x1a2a4a, 1.2));

    // ── Stars ─────────────────────────────────────────────────────────────
    const starCount = 3500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 40 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Earth ─────────────────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x0d3b6e,
      emissive: 0x050e2d,
      specular: 0x2277bb,
      shininess: 18,
      wireframe: false,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Land-mass grid lines (latitude / longitude wireframe overlay)
    const gridGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.001, 36, 18);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    scene.add(new THREE.Mesh(gridGeo, gridMat));

    // ── Atmosphere glow ───────────────────────────────────────────────────
    // Outer soft shell — additive blending gives the classic halo look
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.18, 64, 64);
    const atmoMat = new THREE.MeshPhongMaterial({
      color: 0x0066cc,
      emissive: 0x003388,
      transparent: true,
      opacity: 0.18,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Inner rim glow (BackSide trick for limb brightening)
    const rimGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.06, 64, 64);
    const rimMat = new THREE.MeshPhongMaterial({
      color: 0x00aaff,
      emissive: 0x0044aa,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(rimGeo, rimMat));

    // ── Satellite marker group (populated later) ──────────────────────────
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);

    // ── Pointer / mouse state ─────────────────────────────────────────────
    const spherical = { theta: 0, phi: Math.PI / 2, radius: 3.2 };

    // ── Resize handler ────────────────────────────────────────────────────
    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(el);

    // ── Render loop ───────────────────────────────────────────────────────
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      // Slow auto-rotation when not dragging
      if (!stateRef.current?.isDragging) {
        spherical.theta -= 0.0015;
      }
      // Orbit camera around origin
      camera.position.set(
        spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
        spherical.radius * Math.cos(spherical.phi),
        spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      );
      camera.lookAt(0, 0, 0);
      // Slowly rotate the marker group for orbital drift feel
      markerGroup.rotation.y += 0.0008;
      renderer.render(scene, camera);
    };
    animate();

    stateRef.current = {
      renderer,
      scene,
      camera,
      earth,
      markerGroup,
      frameId,
      isDragging: false,
      lastPointer: { x: 0, y: 0 },
      spherical,
    };

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild satellite markers when prop changes ────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    // Clear old markers
    s.markerGroup.clear();

    if (satellites.length === 0) return;

    // Shared geometry for all markers (instancing-light approach: one Mesh per sat)
    // For up to ~500 sats this is fine; swap to InstancedMesh for larger sets
    const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);

    satellites.forEach((sat) => {
      const color = markerColor(sat.approx_altitude_km);
      const pos = satellitePosition(sat);

      // Core dot
      const dotMat = new THREE.MeshBasicMaterial({ color });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      s.markerGroup.add(dot);

      // Glow halo (additive sprite-like shell)
      const haloGeo = new THREE.SphereGeometry(0.028, 8, 8);
      const haloMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(pos);
      s.markerGroup.add(halo);
    });
  }, [satellites]);

  // ── Pointer / mouse event handlers ────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s) return;
    s.isDragging = true;
    s.lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s || !s.isDragging) return;
    const dx = e.clientX - s.lastPointer.x;
    const dy = e.clientY - s.lastPointer.y;
    s.lastPointer = { x: e.clientX, y: e.clientY };
    s.spherical.theta -= dx * 0.005;
    s.spherical.phi = THREE.MathUtils.clamp(
      s.spherical.phi - dy * 0.005,
      0.15,       // prevent flipping past north pole
      Math.PI - 0.15
    );
  }, []);

  const onPointerUp = useCallback(() => {
    const s = stateRef.current;
    if (s) s.isDragging = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const s = stateRef.current;
    if (!s) return;
    s.spherical.radius = THREE.MathUtils.clamp(
      s.spherical.radius + e.deltaY * 0.003,
      1.5,   // max zoom in
      8.0    // max zoom out
    );
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-700/50 bg-[#020818]"
         style={{ height: "480px" }}>
      {/* Three.js canvas mount point */}
      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      />

      {/* HUD overlays */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top-left label */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="rounded border border-cyan-500/30 bg-[#020818]/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-400 backdrop-blur-sm">
            3D Orbital View
          </span>
        </div>

        {/* Satellite count badge */}
        <div className="absolute right-4 top-4">
          <span className="rounded border border-slate-600/50 bg-[#020818]/70 px-2 py-1 text-[11px] text-slate-400 backdrop-blur-sm">
            {loading ? "Loading…" : `${satellites.length} objects plotted`}
          </span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded border border-slate-700/40 bg-[#020818]/75 px-3 py-2.5 backdrop-blur-sm">
          {[
            { color: "#ef4444", label: "< 400 km  Critical" },
            { color: "#f59e0b", label: "400–600 km  High" },
            { color: "#34d399", label: "600–2 000 km  LEO" },
            { color: "#00d4ff", label: "> 2 000 km  MEO/GEO" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 right-4 text-[10px] text-slate-600">
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
}
