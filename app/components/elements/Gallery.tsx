/**
 * Untitled Gallery — galerie générée par Creative Gallery Builder.
 * Layout: circular  ·  Effets hover: Zoom, RGB Split
 *
 * Dépendances : three @react-three/fiber @react-three/drei gsap
 * NOTE : remplacez les URL d'images par vos assets définitifs (les URL
 *        blob locales ne sont valides que dans la session de l'éditeur).
 *
 * Séquence de chargement (pilotée par GSAP) :
 *   0. préchargement des textures  → compteur DOM plein écran
 *   1. « spin »     → les photos apparaissent et l'anneau tourne en rond
 *   2. « morph »    → chaque photo rejoint, l'une après l'autre, une rangée
 *                     façon carousel en bas de l'écran
 *   3. « carousel » → la molette fait défiler la rangée en boucle, et
 *                     `onIntroComplete` laisse le parent révéler les textes
 */
"use client";

// three.js et GSAP animent des objets en mutant leurs propriétés (position,
// scale, uniforms) hors du modèle React : la règle d'immutabilité du compilo
// React ne s'applique pas à ce fichier.
/* eslint-disable react-hooks/immutability */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useProgress, useTexture } from "@react-three/drei";
import gsap from "gsap";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
// uReveal démarre à 0 : rien n'est visible avant que l'intro ne le révèle.
function makeUniforms() {
  return {
    uTexture: { value: null as THREE.Texture | null },
    uOpacity: { value: 1 },
    uHover: { value: 0 },
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uZoomAmount: { value: 0.15 },
    uRgbAmount: { value: 0.012 },
    uRgbDir: { value: [1, 0] },
  };
}

// URL Pexels reconstruites depuis les IDs des fichiers d'origine
// (les URL blob de l'éditeur ne survivent pas au rechargement).
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

type GalleryItemData = {
  url: string;
  /** Ratio d'origine de l'image, seule donnée de taille conservée : les
   *  dimensions finales sont dérivées du viewport (cf. `useLayout`). */
  aspect: number;
  alt: string;
};

const ITEMS: GalleryItemData[] = [
  { url: pexels(16973549), aspect: 2 / 3, alt: "pexels-casnafu-16973549.jpg" },
  { url: pexels(17473442), aspect: 2 / 3, alt: "pexels-casnafu-17473442.jpg" },
  { url: pexels(28010646), aspect: 2 / 3, alt: "pexels-casnafu-28010646.jpg" },
  { url: pexels(4551840), aspect: 2 / 2.994169096209913, alt: "pexels-cottonbro-4551840.jpg" },
  { url: pexels(10980925), aspect: 2 / 2.9997588618278272, alt: "pexels-saidpexels-10980925.jpg" },
  { url: pexels(18246691), aspect: 2 / 3, alt: "pexels-saidpexels-18246691.jpg" },
  { url: pexels(31709372), aspect: 2 / 3, alt: "pexels-svitlana-shakalova-1789851085-31709372.jpg" },
  { url: pexels(38359605), aspect: 2 / 3, alt: "pexels-wendywei-38359605.jpg" },
];

/** Délai laissé à l'écran de chargement pour s'effacer avant l'intro (s). */
const INTRO_DELAY = 0.45;
/** Filet de sécurité : au-delà, l'écran de chargement se retire quoi qu'il arrive (ms). */
const LOADER_TIMEOUT = 20000;

/** Objets three.js d'un item, publiés au parent pour être animés par GSAP. */
type Slot = { mesh: THREE.Mesh; material: THREE.ShaderMaterial };

type Layout = {
  cards: { ringW: number; ringH: number; carW: number; carH: number }[];
  /** Position sur l'anneau (phase 1). */
  ring: [number, number][];
  /** Position dans la rangée du bas (phase 2 & 3). */
  carousel: [number, number][];
  /** Largeur d'un cycle complet de la rangée, pour le défilement infini. */
  span: number;
};

/**
 * Les deux mises en page sont dérivées du viewport (unités monde =
 * pixels / zoom) : l'anneau et le carousel restent donc cadrés quelle que
 * soit la taille de l'écran.
 */
function useLayout(): Layout {
  const { viewport } = useThree();

  return useMemo(() => {
    const n = ITEMS.length;
    const radius = Math.min(viewport.width, viewport.height) * 0.32;
    const ringH = radius * 0.58;
    const carH = Math.min(viewport.height * 0.26, viewport.width * 0.22);
    const gap = carH * 0.12;

    const cards = ITEMS.map((item) => ({
      ringW: ringH * item.aspect,
      ringH,
      carW: carH * item.aspect,
      carH,
    }));

    const total = cards.reduce((sum, c) => sum + c.carW, 0) + gap * (n - 1);
    const ring: [number, number][] = [];
    const carousel: [number, number][] = [];
    let x = -total / 2;

    cards.forEach((card, i) => {
      // -PI/2 + i * 2PI/n : reprend l'ordre de l'anneau d'origine
      // (première photo en bas, puis sens anti-horaire).
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / n;
      ring.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      carousel.push([
        x + card.carW / 2,
        -viewport.height / 2 + card.carH / 2 + viewport.height * 0.06,
      ]);
      x += card.carW + gap;
    });

    return { cards, ring, carousel, span: total + gap };
  }, [viewport.width, viewport.height]);
}

/** Ramène `v` dans [-span/2, span/2) → rangée infinie. */
const wrap = (v: number, span: number) =>
  ((((v + span / 2) % span) + span) % span) - span / 2;

/** Un item : plan texturé + shader composé, animation de survol. */
function GalleryItem({
  url,
  index,
  registry,
}: {
  url: string;
  index: number;
  registry: RefObject<(Slot | null)[]>;
}) {
  const texture = useTexture(url, (t) => {
    (t as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
  });
  const hover = useRef(0);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => makeUniforms(), []);

  // R3F copie la prop `uniforms` dans le matériau au montage : muter
  // l'objet mémoïsé n'atteint jamais le shader. On passe donc par les
  // uniforms du matériau lui-même.
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture;
    }
  }, [texture]);

  // Publication au parent (les effets enfants tournent avant ceux du
  // parent : la timeline d'intro trouve donc tous les slots remplis).
  // Aucune transformation n'est posée en JSX : position / échelle /
  // rotation sont pilotées par GSAP et par la boucle de rendu.
  useEffect(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    const slots = registry.current;
    if (!mesh || !material) return;
    mesh.scale.set(0, 0, 1);
    slots[index] = { mesh, material };
    return () => {
      slots[index] = null;
    };
  }, [index, registry]);

  useFrame((state, dt) => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    u.uHover.value += (hover.current - u.uHover.value) * Math.min(1, dt * 10);
    u.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh
      ref={meshRef}
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
 * Chef d'orchestre : joue l'intro (anneau qui tourne → rangée en bas) puis
 * passe la main au mode carousel piloté à la molette.
 */
function GalleryStage({
  onReady,
  onIntroComplete,
}: {
  onReady?: () => void;
  onIntroComplete?: () => void;
}) {
  const registry = useRef<(Slot | null)[]>(ITEMS.map(() => null));
  const group = useRef<THREE.Group>(null);
  const phase = useRef<"spin" | "morph" | "carousel">("spin");
  const scroll = useRef({ target: 0, current: 0 });

  // La timeline est construite une seule fois, au montage (donc après le
  // chargement des textures, grâce au <Suspense> parent). On lit la mise
  // en page via une ref pour ne pas rejouer l'intro à chaque resize.
  const layout = useLayout();
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const slots = registry.current.filter((s): s is Slot => s !== null);
    const ring = group.current;
    if (!ring || slots.length !== ITEMS.length) return;

    const L = layoutRef.current;

    slots.forEach((slot, i) => {
      slot.mesh.position.set(L.ring[i][0], L.ring[i][1], 0);
      slot.mesh.rotation.z = 0;
      slot.mesh.scale.set(0, 0, 1);
      slot.material.uniforms.uReveal.value = 0;
    });
    ring.rotation.z = 0;

    // Les textures sont là (le <Suspense> parent a résolu) : l'écran de
    // chargement peut se retirer pendant que l'anneau se met à tourner.
    onReady?.();

    const SPIN = 2.6;
    const tl = gsap.timeline({ delay: INTRO_DELAY });

    tl.addLabel("spin", 0)
      // 1. les photos se révèlent une à une pendant que l'anneau tourne
      .to(
        slots.map((s) => s.material.uniforms.uReveal),
        { value: 1, duration: 0.5, ease: "none", stagger: 0.07 },
        "spin"
      )
      .to(
        slots.map((s) => s.mesh.scale),
        {
          x: (i: number) => L.cards[i].ringW,
          y: (i: number) => L.cards[i].ringH,
          duration: 0.9,
          ease: "back.out(1.6)",
          stagger: 0.07,
        },
        "spin"
      )
      // deux tours pleins : on retombe sur une rotation nulle, sans saut
      .to(ring.rotation, { z: Math.PI * 4, duration: SPIN, ease: "power2.inOut" }, "spin")
      .addLabel("morph", `spin+=${SPIN}`)
      .call(
        () => {
          ring.rotation.z = 0;
          slots.forEach((s) => (s.mesh.rotation.z = 0));
          phase.current = "morph";
        },
        undefined,
        "morph"
      )
      // 2. chacune rejoint sa place dans la rangée du bas, l'une après l'autre
      .to(
        slots.map((s) => s.mesh.position),
        {
          x: (i: number) => L.carousel[i][0],
          y: (i: number) => L.carousel[i][1],
          duration: 1.1,
          ease: "power3.inOut",
          stagger: 0.1,
        },
        "morph"
      )
      .to(
        slots.map((s) => s.mesh.scale),
        {
          x: (i: number) => L.cards[i].carW,
          y: (i: number) => L.cards[i].carH,
          duration: 1.1,
          ease: "power3.inOut",
          stagger: 0.1,
        },
        "morph"
      )
      .fromTo(
        slots.map((s) => s.mesh.rotation),
        { z: (i: number) => (i % 2 ? 0.14 : -0.14) },
        { z: 0, duration: 1.2, ease: "power2.out", stagger: 0.1 },
        "morph"
      )
      // 3. la main passe au carousel — et au parent pour les textes
      .call(() => {
        phase.current = "carousel";
        onIntroComplete?.();
      });

    return () => {
      tl.kill();
    };
  }, [onReady, onIntroComplete]);

  // La molette ne fait défiler qu'une fois l'intro terminée.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (phase.current !== "carousel") return;
      scroll.current.target -= e.deltaY * 0.004;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useFrame((_, dt) => {
    const slots = registry.current;
    const L = layoutRef.current;

    if (phase.current === "spin") {
      // contre-rotation : les photos orbitent mais restent droites
      const z = group.current?.rotation.z ?? 0;
      for (const slot of slots) if (slot) slot.mesh.rotation.z = -z;
      return;
    }

    if (phase.current !== "carousel") return; // « morph » : GSAP a la main

    const s = scroll.current;
    s.current += (s.target - s.current) * Math.min(1, dt * 5);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      slot.mesh.position.x = wrap(L.carousel[i][0] + s.current, L.span);
      slot.mesh.position.y = L.carousel[i][1];
      slot.mesh.scale.set(L.cards[i].carW, L.cards[i].carH, 1);
    }
  });

  return (
    <group ref={group}>
      {ITEMS.map((item, i) => (
        <GalleryItem key={item.url} url={item.url} index={i} registry={registry} />
      ))}
    </group>
  );
}

/** Compteur plein écran affiché le temps du téléchargement des textures. */
function Preloader({ ready }: { ready: boolean }) {
  const { progress } = useProgress();
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  // 100 n'est affiché qu'au signal de la galerie : `progress` peut atteindre
  // 100 avant que les textures ne soient réellement prêtes à être rendues.
  const shown = ready ? 100 : Math.min(99, Math.round(progress));

  useEffect(() => {
    if (!ready || !root.current) return;
    const tween = gsap.to(root.current, {
      autoAlpha: 0,
      duration: 0.6,
      delay: 0.15,
      ease: "power2.out",
      onComplete: () => setGone(true),
    });
    return () => {
      tween.kill();
    };
  }, [ready]);

  // Filet de sécurité : une texture qui ne répond pas ne doit pas laisser
  // l'écran de chargement en place indéfiniment.
  useEffect(() => {
    const id = setTimeout(() => setGone(true), LOADER_TIMEOUT);
    return () => clearTimeout(id);
  }, []);

  if (gone) return null;

  return (
    <div className="gallery-loader" ref={root}>
      <span className="gallery-loader__count">
        {String(shown).padStart(3, "0")}
      </span>
      <span className="gallery-loader__bar">
        <i style={{ transform: `scaleX(${shown / 100})` }} />
      </span>
    </div>
  );
}

/** Galerie « Untitled Gallery ». */
export default function Gallery({
  onIntroComplete,
}: {
  /** Appelé quand l'anneau est devenu carousel : au parent de révéler ses textes. */
  onIntroComplete?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }}
        dpr={[1, 2]}
      >
        {/* Pas de <color attach="background"> : le canvas reste transparent
            (THREE.Color ne supporte pas "transparent"). */}
        <Suspense fallback={null}>
          <GalleryStage onReady={handleReady} onIntroComplete={onIntroComplete} />
        </Suspense>
      </Canvas>
      <Preloader ready={ready} />
    </>
  );
}
