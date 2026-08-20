'use client';
import * as THREE from 'three';
import { useRef , useEffect } from 'react';

const Scene = () => {
    const scene = useRef<THREE.Scene>(new THREE.Scene());
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const progress = useRef(0);
    const vertexShader = `
        attribute float aType;
        varying float vType;
        uniform float uTime;
        uniform float uProgress;
        varying float vDist;

        void main() {

            vec3 pos = position;

            float wave =
                sin(pos.x * 5.0 + uTime) * 0.15 +
                sin(pos.y * 5.0 + uTime * 1.2) * 0.15 +
                sin(pos.z * 5.0 + uTime * 0.8) * 0.15;

            pos += normalize(pos) * wave * uProgress;

            vType = aType;

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
        varying float vType;
        uniform sampler2D uTexture;
        void main() {

           
            vec2 center =
                gl_PointCoord -
                vec2(0.5);

            float d =
                length(center);

            if (d > 0.5) {
                discard;
            }

            vec3 orange =
                vec3(1.0,0.5,0.0);

            vec3 pink =
                vec3(1.0,0.0,0.8);

            vec3 purple =
                vec3(0.6,0.1,1.0);

            float t =
                smoothstep(
                    1.3,
                    1.8,
                    vDist
                );

            vec3 color =
                mix(
                    orange,
                    pink,
                    t
                );

            color =
                mix(
                    color,
                    purple,
                    t
                );

            gl_FragColor = vec4(color,1.0);
    }
    `
    useEffect(() => {
        if (!canvasRef.current) return;
        const loader = new THREE.TextureLoader();
        const textures = [
            loader.load('/images/ahmetyuksek-monk-10278772.png')
        ];
        const image_single = new THREE.TextureLoader().load(
  '/images/ahmetyuksek-monk-10278772.png'
);

        const textures_blob = [
            loader.load('/images/ahmetyuksek-monk-10278772.png'),
            loader.load('/images/ahmetyuksek-monk-10278772.png'),
            loader.load('/images/ahmetyuksek-monk-10278772.png'),
            loader.load('/images/ahmetyuksek-monk-10278772.png'),
           
        ];

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

        const geometry = new THREE.SphereGeometry(2.5,128,128);
        const count = geometry.attributes.position.count;
        const newPositions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            newPositions[i] = 0;
        }
        newPositions[1000] = 1;
        newPositions[5000] = 1;
        newPositions[9000] = 1;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uProgress: { value: progress.current },
                uTexture: { value: image_single }
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
        // scene.current.add(points);
        const anchors = [
        new THREE.Vector3(1, 0.2, 0.5).normalize(),
        new THREE.Vector3(-1, 0.5, 0.2).normalize(),
        new THREE.Vector3(0.6, -0.3, -1).normalize(),
        new THREE.Vector3(-0.4, -0.8, 1).normalize(),
        ];

        const cards_blob: THREE.Mesh[] = [];

        textures_blob.forEach((texture) => {
            
            const card = new THREE.Mesh(
                new THREE.PlaneGeometry(4.2, 2.4),
                new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                })
            );

            cards_blob.push(card);
            scene.current.add(card);
        });




        const cards: THREE.Mesh[] = [];

        // textures.forEach((texture, index) => {
        //     const cardGeometry = new THREE.PlaneGeometry(1.8,1.2);
        //     const cardMaterial =
        //     new THREE.MeshBasicMaterial({
        //         map: texture,
        //         transparent: true,
        //         side: THREE.DoubleSide,
        //     });
        //     const card = new THREE.Mesh(
        //         cardGeometry,
        //         cardMaterial
        //     );

        //     const angle =
        //         (index / textures.length) *
        //         Math.PI * 2;

        //     const radius = 7;

        //     card.position.set(
        //         Math.cos(angle) * radius,
        //         -3.5,
        //         Math.sin(angle) * radius
        //     );

        //     cards.push(card);

        //     scene.current.add(card);
        // });

        const clock = new THREE.Clock();

        const animate = () => {
        requestAnimationFrame(animate);

        material.uniforms.uTime.value =
        clock.getElapsedTime();

        material.uniforms.uProgress.value =Math.min(progress.current, 1);
        
        points.rotation.y += 0.0015;
        // points.rotation.x += 0.0015;
        const elapsedTime =
        clock.getElapsedTime();

        cards_blob.forEach((card, index) => {

            const anchor = anchors[index];

            const wave =
                Math.sin(anchor.x * 5 + elapsedTime) * 0.15 +
                Math.sin(anchor.y * 5 + elapsedTime * 1.2) * 0.15 +
                Math.sin(anchor.z * 5 + elapsedTime * 0.8) * 0.15;

            const sphereRadius = 2.5;

            const distance =
                sphereRadius +
                 progress.current +
                0.8;

            const position =
                anchor.clone()
                .multiplyScalar(distance);

            position.applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                points.rotation.y
            );

            position.y -= 3.5;

            card.position.copy(position);

            card.lookAt(camera.position);

          });




        cards.forEach((card, index) => {
            const angle =
                elapsedTime * 0.25 +
                (index / cards.length) *
                Math.PI * 2;

            const radius = 7;

            card.position.x =
                Math.cos(angle) * radius;

            card.position.z =
                Math.sin(angle) * radius;

            card.position.y =
                -3.5 +
                Math.sin(
                elapsedTime * 2 +
                index
                ) * 0.3;

            card.lookAt(
                camera.position
            );
    });

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