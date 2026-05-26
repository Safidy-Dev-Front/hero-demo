'use client';
import * as THREE from 'three';
import { useRef , useEffect} from 'react';

const Scene = () => {
    const scene = useRef<THREE.Scene>(new THREE.Scene());
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const vertexShader = `
        uniform float uTime;

        varying float vDist;

        void main() {

            vec3 pos = position;

            float wave =
                sin(pos.x * 5.0 + uTime) * 0.15 +
                sin(pos.y * 5.0 + uTime * 1.2) * 0.15 +
                sin(pos.z * 5.0 + uTime * 0.8) * 0.15;

            pos += normalize(pos) * wave;

            vDist = length(pos);

            vec4 mvPosition =
                modelViewMatrix * vec4(pos, 1.0);

            gl_Position =
                projectionMatrix * mvPosition;

            gl_PointSize = 4.0;
        }
    `
    const fragmentShader = `
        varying float vDist;

        void main() {

            vec2 center = gl_PointCoord - vec2(0.5);

            float d = length(center);

            if (d > 0.5) {
                discard;
            }

            vec3 orange = vec3(
                1.0,
                0.5,
                0.0
            );

            vec3 pink = vec3(
                1.0,
                0.0,
                0.7
            );

            vec3 purple = vec3(
                0.4,
                0.1,
                1.0
            );

            float t =
                smoothstep(1.3, 1.8, vDist);

            vec3 color =
                mix(orange, pink, t);

            color =
                mix(color, purple, t * 0.8);

            float alpha =
                1.0 - smoothstep(
                    0.3,
                    0.5,
                    d
                );

            gl_FragColor =
                vec4(color, alpha);
        }
    `
    useEffect(() => {
        if (!canvasRef.current) return;

        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;


        const particleCount = 15000;
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const radius = 3;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] =
                radius * Math.sin(phi) * Math.cos(theta);

            positions[i * 3 + 1] =
                radius * Math.sin(phi) * Math.sin(theta);

            positions[i * 3 + 2] =
                radius * Math.cos(phi);
        }

        const geometry = new THREE.SphereGeometry(4,128,128);
       
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            blending:
                THREE.AdditiveBlending,
            depthWrite: false,
            });

        const points = new THREE.Points(
            geometry,
            material
        );
        points.position.y = -3.5;

        camera.position.z = 7;
        scene.current.add(points);
        // const object = new THREE.Mesh(geometry, material);
        // object.position.y = -2.5;
        // scene.current.add(object);

        // const animate = () => {
        //     requestAnimationFrame(animate);
        //     object.rotation.x += 0.01;
        //     object.rotation.y += 0.01;
        //     renderer.render(scene.current, camera);
        // };

        // animate();

        const clock = new THREE.Clock();

        const animate = () => {
        requestAnimationFrame(animate);

        material.uniforms.uTime.value =
            clock.getElapsedTime();

        points.rotation.y += 0.0015;

        renderer.render(
            scene.current,
            camera
        );
        };

        animate();

        return () => {
            renderer.dispose();
        };
    }, []);

    return <>
        <div className="scene-threejs">
            <canvas className="webgl"  ref={canvasRef}></canvas>
        </div>
    </>;
};

export default Scene;