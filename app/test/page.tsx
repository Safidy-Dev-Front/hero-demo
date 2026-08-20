"use client";

import dynamic from "next/dynamic";

// WebGL = client only → import dynamique sans SSR.
const Gallery = dynamic(() => import("../components/elements/Gallery"), { ssr: false });

export default function Test() {
  // Le Canvas R3F remplit son parent : sans hauteur explicite,
  // il retombe sur 300×150px (taille par défaut d'un canvas).
  return (
    <div className="test-page" style={{ position: "fixed", inset: 0 }}>
      <Gallery />
    </div>
  );
}
