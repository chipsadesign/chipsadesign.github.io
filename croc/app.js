import * as THREE from 'https://threejs.org/build/three.module.js';

function lerp(a, b, n) {
    return (1 - n) * a + n * b;
}

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLightRadius() {
    switch (true) {
        case window.matchMedia('(max-width: 767px)').matches:
            return 0.32;
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

    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.setSize(windowWidth, windowHeight);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
        75,
        windowWidth / windowHeight,
        1,
        1000,
    );
    camera.position.set(0, 0, 1);
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
            uMouseVec: { value: new THREE.Vector2(0, 0) }, // mouse position
            uLightRadius: { value: lightRadius },
            uColorFrom: { value: new THREE.Color('#120073') }, // gradient start value
            uColorTo: { value: new THREE.Color('#2c003c') }, // gradient end value
            uLightIntensity: { value: 0.4 }, // [0, 1]
            uGridIntensity: { value: windowWidth <= 767 ? 3 : 1 },
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
            uniform float uGridIntensity;
            varying vec2 vUv;
            varying vec3 vPosition;

            vec2 tile(vec2 _st, float _zoom) {
                _st *= _zoom;
                return fract(_st);
            }

            float box(vec2 _st, vec2 _size, float _smoothEdges) {
                _size = vec2(0.5) - _size * 0.5;
                vec2 aa = vec2(_smoothEdges * 0.5);
                vec2 uv = smoothstep(_size, _size + aa, _st);
                uv *= smoothstep(_size, _size + aa, vec2(1.) - _st);
                return uv.x * uv.y;
            }

            void main() {
                vec2 uv = vUv;

                // Background gradient
                vec4 gradientColor = vec4(mix(uColorFrom, uColorTo, uv.x + 0.16), 1.);

                // Background grid
                vec2 st = gl_FragCoord.xy / vec2(min(uResolution.x, uResolution.y));
                vec2 coord = vPosition.xy;
                float gridZoom = 4.;
                // vec4 gridColor = vec4(1., 1., 1., 1.);
                // Compute anti-aliased world-space grid lines
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
                float line = min(grid.x, grid.y);
                float gridLines = 0.3 * (1. - min(line, 0.1));
                vec4 gridColor = vec4(vec3(1. - box(tile(st, gridZoom), vec2(0.995), 0.01)), 1.);

                // bg gradient + grid
                vec4 color = mix(gradientColor, gridColor, gridLines * 0.2 * uGridIntensity);

                // define circle
                float dist = length(gl_FragCoord.xy - uResolution * uMouseVec) * (1. / uLightRadius);

                // Add a lightbulb effect
                float ambient = 0.2;

                color = vec4(color.rgb, clamp(1. - color.a * smoothstep(dist * 0.01, 0., 1.) * (1. - ambient), 0., 1.) * uLightIntensity);
                
                // Resulting color
                gl_FragColor = color;
            }
        `,
    });

    const bgPlane = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(1, 1, 1, 1),
        bgMaterial,
    );
    group.add(bgPlane);

    function fitPlane() {
        // Stretch the plane to fit the viewport
        let dist = camera.position.z - bgPlane.position.z;
        // let height = 8; // desired height to fit
        let height = 1; // desired height to fit
        // camera.fov = 2 * Math.atan(height / (2 * dist)) * (180 / Math.PI);
        camera.fov = 2 * (180 / Math.PI) * Math.atan(height / (2 * dist));
        bgPlane.scale.x = windowWidth / windowHeight;
        camera.updateProjectionMatrix();
    }

    fitPlane();
    render();

    function render() {
        const interpolatedPrevX = lerp(prevX, x, ease);
        const interpolatedPrevY = lerp(prevY, y, ease);
        prevX = interpolatedPrevX > 0.5 ? interpolatedPrevX : x;
        prevY = interpolatedPrevY > 0.5 ? interpolatedPrevY : y;
        prevClientX = lerp(prevClientX, x, ease);
        prevClientY = lerp(prevClientY, y, ease);
        let maskX = 0;

        if (windowWidth <= 767) {
            // mobile
            const offsetBottom = 70;
            // bgMaterial.uniforms.uMouseVec.value.x = 1.42;
            // bgMaterial.uniforms.uMouseVec.value.y =
            //     -(((windowHeight / 2 - prevClientY) / windowHeight) * 3) + 1.73;
            bgMaterial.uniforms.uMouseVec.value.x = 1;
            bgMaterial.uniforms.uMouseVec.value.y = -(
                ((windowHeight / 2 -
                    prevClientY -
                    (offsetBottom + lightsourceRect.height / 2)) /
                    windowHeight) *
                    2 -
                1
            );

            maskX = textElementRect.left - textElementRect.width / 2;
        } else {
            // desktop
            bgMaterial.uniforms.uMouseVec.value.x =
                -((windowWidth / 2 - prevClientX) / windowWidth) * 2 + 1;
            bgMaterial.uniforms.uMouseVec.value.y = 1;
            maskX = -textElementRect.left + prevX;
        }

        // const maskX = -textElementRect.left + prevX;
        const maskY = -(
            -textElementRect.bottom +
            textElementRect.height -
            35 +
            prevY
        );
        console.log(textElementRect.bottom);
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
        bgMaterial.uniforms.uGridIntensity.value = windowWidth <= 767 ? 3 : 1;

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
        fitPlane();
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

        scrollContainer.addEventListener('scroll', () => {
            const scrollY = scrollContainer.scrollTop;
            y = Math.min(scrollY * 0.9, windowHeight - 110);
        });
    }

    // Init
    setTimeout(enableLight, 400);
    lightsources.classList.remove('lightsource--hidden');
});
