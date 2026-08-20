/**
 * Untitled Gallery — galerie générée par Creative Gallery Builder.
 * Layout: circular  ·  Effets hover: Zoom, RGB Split
 *
 * Dépendances : three @react-three/fiber @react-three/drei
 * NOTE : remplacez les URL d'images par vos assets définitifs (les URL
 *        blob locales ne sont valides que dans la session de l'éditeur).
 */
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

// --- Shaders (composés à partir des effets actifs) ---
const VERTEX = `varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAGMENT = `precision highp float;

uniform sampler2D uTexture;
uniform float uOpacity;
uniform float uHover;
uniform float uTime;
uniform float uReveal;
uniform float uZoomAmount;
uniform float uRgbAmount;
uniform vec2 uRgbDir;

varying vec2 vUv;

vec2 fxZoom(vec2 uv, float h, float amt) {
  return (uv - 0.5) * (1.0 - amt * h) + 0.5;
}

vec3 fxRgbSplit(sampler2D tex, vec2 uv, vec3 base, float h, float amt, vec2 dir) {
  vec2 o = dir * amt * h;
  float r = texture2D(tex, uv + o).r;
  float b = texture2D(tex, uv - o).b;
  return vec3(r, base.g, b);
}

void main() {
  vec2 uv = vUv;
  uv = fxZoom(uv, uHover, uZoomAmount);
  vec4 color = texture2D(uTexture, uv);
  color.rgb = fxRgbSplit(uTexture, uv, color.rgb, uHover, uRgbAmount, uRgbDir);
  color.a *= uOpacity * uReveal;
  gl_FragColor = color;
}`;

// --- Uniforms (valeurs d'effets bakées) ---
function makeUniforms() {
  return {
    uTexture: { value: null as THREE.Texture | null },
    uOpacity: { value: 1 },
    uHover: { value: 0 },
    uTime: { value: 0 },
    uReveal: { value: 1 },
    uZoomAmount: { value: 0.15 },
    uRgbAmount: { value: 0.012 },
    uRgbDir: { value: [1, 0] },
  };
}

type GalleryItemData = {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  alt: string;
};

// URL Pexels reconstruites depuis les IDs des fichiers d'origine
// (les URL blob de l'éditeur ne survivent pas au rechargement).
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

const ITEMS: GalleryItemData[] = [
  { url: pexels(16973549), position: [3.1840816777831187e-16, -5.2, 0], rotation: [0, 0, 0], size: [2, 3], alt: "pexels-casnafu-16973549.jpg" },
  { url: pexels(17473442), position: [3.6769552621700474, -3.676955262170047, 0], rotation: [0, 0, 0], size: [2, 3], alt: "pexels-casnafu-17473442.jpg" },
  { url: pexels(28010646), position: [5.2, 0, 0], rotation: [0, 0, 0], size: [2, 3], alt: "pexels-casnafu-28010646.jpg" },
  { url: pexels(4551840), position: [3.6769552621700474, 3.676955262170047, 0], rotation: [0, 0, 0], size: [2, 2.994169096209913], alt: "pexels-cottonbro-4551840.jpg" },
  { url: pexels(10980925), position: [3.1840816777831187e-16, 5.2, 0], rotation: [0, 0, 0], size: [2, 2.9997588618278272], alt: "pexels-saidpexels-10980925.jpg" },
  { url: pexels(18246691), position: [-3.676955262170047, 3.6769552621700474, 0], rotation: [0, 0, 0], size: [2, 3], alt: "pexels-saidpexels-18246691.jpg" },
  { url: pexels(31709372), position: [-5.2, 6.368163355566237e-16, 0], rotation: [0, 0, 0], size: [2, 3], alt: "pexels-svitlana-shakalova-1789851085-31709372.jpg" },
  { url: pexels(38359605), position: [-3.676955262170048, -3.676955262170047, 0], rotation: [0, 0, 0], size: [2, 3], alt: "pexels-wendywei-38359605.jpg" },
];

/** Un item : plan texturé + shader composé, animation de survol. */
function GalleryItem({ url, position, rotation, size }: GalleryItemData) {
  const texture = useTexture(url, (t) => {
    (t as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
  });
  const hover = useRef(0);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(makeUniforms, []);

  // R3F copie la prop `uniforms` dans le matériau au montage : muter
  // l'objet mémoïsé n'atteint jamais le shader. On passe donc par les
  // uniforms du matériau lui-même.
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture;
    }
  }, [texture]);

  useFrame((state, dt) => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    u.uHover.value += (hover.current - u.uHover.value) * Math.min(1, dt * 10);
    u.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={[size[0], size[1], 1]}
      onPointerOver={(e) => {
        e.stopPropagation();
        hover.current = 1;
      }}
      onPointerOut={() => {
        hover.current = 0;
      }}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/**
 * Anneau piloté par le scroll : la molette fait tourner le groupe autour
 * de Z (avec inertie), et chaque photo est contre-rotée pour rester droite.
 */
function ScrollRing({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const target = useRef(0);
  const current = useRef(0);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      target.current += e.deltaY * 0.0018;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useFrame((_, dt) => {
    if (!group.current) return;
    current.current += (target.current - current.current) * Math.min(1, dt * 5);
    group.current.rotation.z = current.current;
    for (const child of group.current.children) {
      child.rotation.z = -current.current;
    }
  });

  return <group ref={group}>{children}</group>;
}

/** Galerie « Untitled Gallery ». */
export default function Gallery() {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }}
      dpr={[1, 2]}
    >
      {/* Pas de <color attach="background"> : le canvas reste transparent
          (THREE.Color ne supporte pas "transparent"). */}
      <Suspense fallback={null}>
        <ScrollRing>
          {ITEMS.map((item, i) => (
            <GalleryItem key={i} {...item} />
          ))}
        </ScrollRing>
      </Suspense>
    </Canvas>
  );
}
