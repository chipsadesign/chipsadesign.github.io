import * as THREE from 'https://threejs.org/build/three.module.js';
import Stats from 'https://threejs.org/examples/jsm/libs/stats.module.js';
// import { GUI } from 'https://threejs.org/examples/jsm/libs/dat.gui.module.js';

function lerp(a, b, n) {
    return (1 - n) * a + n * b;
}

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let renderer, camera, stats /* , gui */;

function getLightRadius() {
    switch (true) {
        case window.matchMedia('(max-width: 767px)').matches:
            return 0.3;
        case window.matchMedia('(max-width: 768px)').matches:
            return 0.32;
        case window.matchMedia('(max-width: 1024px)').matches:
            return 0.38;
        case window.matchMedia('(max-width: 1440px)').matches:
            return 0.5;
        case window.matchMedia('(max-width: 1680px)').matches:
            return 0.75;
        default:
            return 1;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const ease = 0.07;
    let windowWidth = window.innerWidth;
    let windowHeight = window.innerHeight;
    const container = document.querySelector('.js-canvas');
    const textElement = document.querySelector('.js-text-block');
    const lightsources = document.querySelector('.js-lightsources');
    const lightsource = document.querySelector('.js-lightsource');
    const screenFirst = document.querySelector('.screen-first');
    let lightsourceRect = lightsource.getBoundingClientRect();
    let textElementRect = textElement.getBoundingClientRect();
    let x = 0;
    let prevX = 0;
    let clientX = 0;
    let prevClientX = 0;
    let y = 0;
    let prevY = 0;
    let prevClientY = 0;
    let lightRadius = getLightRadius();

    if (windowWidth <= 767) {
        textElement.style.setProperty(
            '--mask-size',
            `${lightsourceRect.width * 0.3}px`,
        );
    } else {
        textElement.style.setProperty(
            '--mask-size',
            `${lightsourceRect.width * 0.2}px`,
        );
    }

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.setSize(windowWidth, windowHeight);

    // stats = new Stats();

    container.appendChild(renderer.domElement);
    // document.body.appendChild(stats.dom);

    camera = new THREE.PerspectiveCamera(
        75,
        windowWidth / windowHeight,
        1,
        1000,
    );
    camera.position.set(0, 0, 20);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const scene = new THREE.Scene();
    const group = new THREE.Group();

    scene.add(group);

    const bgMaterial = new THREE.ShaderMaterial({
        extensions: {
            derivatives: true,
        },
        transparent: true,
        uniforms: {
            uResolution: {
                value: new THREE.Vector2(windowWidth, windowHeight),
            },
            uMouseVec: { value: new THREE.Vector2(0, 0) },
            uLightRadius: { value: lightRadius },
            uColorFrom: { value: new THREE.Color('#120073') },
            uColorTo: { value: new THREE.Color('#2c003c') },
            uLightIntensity: { value: 0.4 }, // [0, 1]
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                vUv = uv;
                vPosition = position;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec2 uResolution;
            uniform vec2 uMouseVec;
            uniform vec3 uColorFrom;
            uniform vec3 uColorTo;
            uniform float uLightRadius;
            uniform float uLightIntensity;
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                vec2 uv = vUv;
                vec2 coord = vPosition.xy;

                // Background gradient
                vec4 gradientColor = vec4(mix(uColorFrom, uColorTo, uv.x + 0.16), 1.0);

                // Background grid
                vec4 gridColor = vec4(1.0, 1.0, 1.0, 1.0);
                // Compute anti-aliased world-space grid lines
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
                float line = min(grid.x, grid.y);
                float gridLines = 1.0 - min(line, 1.0);

                // bg gradient + grid
                vec4 color = mix(gradientColor, gridColor, gridLines * 0.2);

                // define circle
                float dist = length(gl_FragCoord.xy - uResolution * uMouseVec) * (1. / uLightRadius);

                // Add a lightbulb effect
                float ambient = 0.2;

                color = vec4(color.rgb, clamp(1. - color.a * smoothstep(dist * 0.001, 0., 1.) * (1. - ambient), 0., 1.) * uLightIntensity);
                
                // Resulting color
                gl_FragColor = color;
            }
        `,
    });

    const bgPlane = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(16, 9, 1, 1),
        bgMaterial,
    );
    group.add(bgPlane);

    // Stretch the plane to fit the viewport
    let dist = camera.position.z - bgPlane.position.z;
    let height = 8; // desired height to fit
    camera.fov = 2 * Math.atan(height / (2 * dist)) * (180 / Math.PI);
    camera.updateProjectionMatrix();

    render();

    function render() {
        // stats.update();

        const interpolatedPrevX = lerp(prevX, x, ease);
        const interpolatedPrevY = lerp(prevY, y, ease);
        prevX = interpolatedPrevX > 0.5 ? interpolatedPrevX : x;
        prevY = interpolatedPrevY > 0.5 ? interpolatedPrevY : y;
        prevClientX = lerp(prevClientX, x, ease);
        prevClientY = lerp(prevClientY, y, ease);

        if (windowWidth <= 767) {
            // mobile
            bgMaterial.uniforms.uMouseVec.value.x = 1.42;
            bgMaterial.uniforms.uMouseVec.value.y =
                -(((windowHeight / 2 - prevClientY) / windowHeight) * 3) + 1.73;
        } else {
            // desktop
            bgMaterial.uniforms.uMouseVec.value.x =
                -((windowWidth / 2 - prevClientX) / windowWidth) * 2 + 1;
            bgMaterial.uniforms.uMouseVec.value.y = 1;
        }

        const maskX = -textElementRect.left + prevX;
        const maskY = -(-textElementRect.bottom + prevY);
        textElement.style.setProperty('--mask-x', maskX);
        textElement.style.setProperty('--mask-y', maskY);
        lightsources.style.setProperty('--x', prevX);
        lightsources.style.setProperty('--y', prevY);

        renderer.render(scene, camera);

        requestAnimationFrame(render);
    }

    window.addEventListener('resize', () => {
        windowWidth = window.innerWidth;
        windowHeight = window.innerHeight;
        lightsourceRect = lightsource.getBoundingClientRect();
        textElementRect = textElement.getBoundingClientRect();
        bgMaterial.uniforms.uResolution.value.x = windowWidth;
        bgMaterial.uniforms.uResolution.value.y = windowHeight;
        lightRadius = getLightRadius();
        bgMaterial.uniforms.uLightRadius.value = lightRadius;

        if (windowWidth <= 767) {
            textElement.style.setProperty(
                '--mask-size',
                `${lightsourceRect.width * 0.3}px`,
            );
        } else {
            textElement.style.setProperty(
                '--mask-size',
                `${lightsourceRect.width * 0.2}px`,
            );
        }

        renderer.setSize(windowWidth, windowHeight);
        camera.aspect = windowWidth / windowHeight;
        camera.updateProjectionMatrix();
    });

    function turnLightOn() {
        bgMaterial.uniforms.uLightIntensity.value = 1;
        lightsources.classList.add('on');
    }

    function turnLightOff() {
        bgMaterial.uniforms.uLightIntensity.value = 0.4;
        lightsources.classList.remove('on');
    }

    async function enableLight() {
        turnLightOn();
        await timeout(120);
        turnLightOff();
        await timeout(190);
        turnLightOn();

        screenFirst.addEventListener('mousemove', (event) => {
            clientX = event.clientX;
            x = clientX;
        });

        screenFirst.addEventListener('touchmove', (event) => {
            clientX = event.touches[0].clientX;
            x = clientX;
        });

        const scrollContainer = document.querySelector('.js-scroll-container');

        scrollContainer.addEventListener(
            'scroll',
            () => {
                const scrollY = scrollContainer.scrollTop;
                y = Math.min(scrollY * 0.9, windowHeight - 100);
            },
            // { passive: false },
        );
    }

    // function setGUI() {
    //     const lightsource1Controller = {
    //         blendmode: 'none',
    //         opacity: 1,
    //     };

    //     const lightsource2Controller = {
    //         blendmode: 'none',
    //         opacity: 1,
    //     };

    //     const blendModes = [
    //         'none',
    //         'color',
    //         'color-burn',
    //         'color-dodge',
    //         'darken',
    //         'difference',
    //         'exclusion',
    //         'hard-light',
    //         'hue',
    //         'inherit',
    //         'initial',
    //         'lighten',
    //         'luminosity',
    //         'multiply',
    //         'normal',
    //         'overlay',
    //         'revert',
    //         'saturation',
    //         'screen',
    //         'sort-light',
    //         'unset',
    //     ];

    //     gui = new GUI();

    //     var lightsource1Folder = gui.addFolder('Lightsource 1');
    //     lightsource1Folder
    //         .add(lightsource1Controller, 'blendmode', blendModes)
    //         .onChange((value) => {
    //             Array.from(
    //                 document.querySelectorAll('.lightsource'),
    //             )[0].style.mixBlendMode = value;
    //         });
    //     lightsource1Folder
    //         .add(lightsource1Controller, 'opacity', 0, 1, 0.01)
    //         .onChange((value) => {
    //             Array.from(
    //                 document.querySelectorAll('.lightsource'),
    //             )[0].style.opacity = value;
    //         });
    //     lightsource1Folder.open();

    //     var lightsource2Folder = gui.addFolder('Lightsource 2');
    //     lightsource2Folder
    //         .add(lightsource2Controller, 'blendmode', blendModes)
    //         .onChange((value) => {
    //             Array.from(
    //                 document.querySelectorAll('.lightsource'),
    //             )[1].style.mixBlendMode = value;
    //         });
    //     lightsource2Folder
    //         .add(lightsource2Controller, 'opacity', 0, 1, 0.01)
    //         .onChange((value) => {
    //             Array.from(
    //                 document.querySelectorAll('.lightsource'),
    //             )[1].style.opacity = value;
    //         });
    //     lightsource2Folder.open();
    // }

    setTimeout(enableLight, 400);
    lightsources.classList.remove('lightsource--hidden');

    // setGUI();
});
