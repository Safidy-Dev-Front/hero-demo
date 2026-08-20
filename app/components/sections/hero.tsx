'use client';
import gsap from "gsap";
import SplitText from "gsap/src/SplitText";
import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// WebGL = client only → import dynamique sans SSR.
const Gallery = dynamic(() => import("../elements/Gallery"), { ssr: false });

gsap.registerPlugin(SplitText);

/** Durée max d'attente de la galerie avant de révéler les textes malgré tout. */
const TEXT_FALLBACK_DELAY = 20000;

export default function Hero() {
    // L'état initial (textes masqués) vit dans le SCSS : pas de flash avant
    // l'hydratation, et rien à poser ici avant le premier paint.
    const timeline = useRef<gsap.core.Timeline | null>(null);

    /**
     * Étape 3 de l'intro : tous les textes apparaissent progressivement.
     * Déclenché par la galerie (ou par le filet de sécurité ci-dessous).
     */
    const revealText = useCallback(() => {
        if (timeline.current) return; // une seule lecture
        const split = new SplitText(".title", {
            type: "chars",
            charsClass: "char",
        });

        // Sizing chairs === (accent sur le "D" de DEVELOPPER)
        split.chars[8]?.classList.add("big-chairs");

        timeline.current = gsap
            .timeline()
            .set(".title", { autoAlpha: 1 })
            .from(split.chars, {
                duration: 1,
                y: -100,
                opacity: 0,
                ease: "power4.out",
                stagger: 0.05,
            })
            .to(
                ".create-header .logo-part h4",
                { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" },
                "-=0.5"
            )
            .to(
                ".create-header .nav-item",
                {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.08,
                },
                "-=0.4"
            );
    }, []);

    useEffect(() => {
        const fallback = setTimeout(revealText, TEXT_FALLBACK_DELAY);
        return () => {
            clearTimeout(fallback);
            timeline.current?.kill();
            timeline.current = null;
        };
    }, [revealText]);

  return (
    <>
        <section className="sections-hero">
            <div className="wrapper">
                <h1 className="title">Creative DEVELOPPER</h1>
            </div>
        </section>
        <section className="wrapper-canvas">
            <Gallery onIntroComplete={revealText} />
        </section>
    </>
  );
}
