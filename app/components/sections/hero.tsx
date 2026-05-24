'use client';
import { log } from "console";
import gsap from "gsap";
import SplitText from "gsap/src/SplitText";
import { useEffect } from "react";

gsap.registerPlugin(SplitText);

export default function Hero() {
    useEffect(() => {
        const split = new SplitText(".title", {
            type: "chars",
            charsClass: "char",
        });
        gsap.from(split.chars, {
            duration: 1,
            y: -100,
            opacity: 0,
            ease: "power4.out",
            stagger: 0.05,
        });

        // Sizing chairs ===
        console.log("Text split =>",split.chars[8]);
        let chairs_change = split.chars[8];
        chairs_change.classList.add("big-chairs");
    }, []);

  return (
    <section className="sections-hero">
        <div className="wrapper">
            <h1 className="title">Creative DEVELOPPER</h1>
        </div>
    </section>
  );
}