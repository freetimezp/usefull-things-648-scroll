import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.186.1/three.module.js";

import { vertexShader, fragmentShader } from "./shaders.js";

const config = {
    blurRadius: 0.05,
    blurZone: 0.25,
    aberration: 0.05,
    clampToEdge: false,
};

const lenis = new Lenis();

gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
const geometry = new THREE.PlaneGeometry(1, 1);
const loader = new THREE.TextureLoader();

const viewport = { width: 0, height: 0 };

const uniforms = {
    uBlurRadius: { value: 0 },
    uBlurZone: { value: config.blurZone },
    uAberration: { value: 0 },
    uClampEdges: { value: config.clampToEdge ? 1 : 0 },
};

function updateCoverScale(plane) {
    if (!plane.aspect) return;

    const containerAspect =
        plane.container.clientWidth / plane.container.clientHeight;

    plane.mesh.material.uniforms.uCoverScale.value.set(
        Math.min(containerAspect / plane.aspect, 1),
        Math.min(plane.aspect / containerAspect, 1),
    );
}

function createPlane(container) {
    const img = container.querySelector("img");

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,

        uniforms: {
            ...uniforms,
            uTexture: { value: null },
            uTextureSize: { value: new THREE.Vector2(1, 1) },
            uCoverScale: { value: new THREE.Vector2(1, 1) },
            uImageSize: { value: new THREE.Vector2(1, 1) },
        },
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);

    const plane = { container, mesh, aspect: 0 };

    loader.load(img.src, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        renderer.initTexture(texture);

        material.uniforms.uTexture.value = texture;
        material.uniforms.uTextureSize.value.set(
            texture.image.width,
            texture.image.height,
        );

        plane.aspect = texture.image.width / texture.image.height;
        updateCoverScale(plane);

        mesh.visible = true;
        img.style.opacity = 0;

        lenis.resize();
    });

    return plane;
}

const planes = [...document.querySelectorAll(".img")].map(createPlane);

function resize() {
    viewport.width = document.documentElement.clientWidth;
    viewport.height = innerHeight;

    camera.left = -viewport.width / 2;
    camera.right = viewport.width / 2;

    camera.top = viewport.height / 2;
    camera.bottom = -viewport.height / 2;

    camera.updateProjectionMatrix();

    renderer.setSize(viewport.width, viewport.height);

    uniforms.uBlurRadius.value = viewport.height * config.blurRadius;
    uniforms.uAberration.value = viewport.height * config.aberration;

    planes.forEach(updateCoverScale);
}

function syncPlanes() {
    const padding = config.clampToEdge ? 0 : uniforms.uBlurRadius.value * 2;

    planes.forEach(({ container, mesh }) => {
        const bounds = container.getBoundingClientRect();

        mesh.scale.set(bounds.width + padding, bounds.height + padding, 1);

        mesh.position.set(
            bounds.left + bounds.width / 2 - viewport.width / 2,
            viewport.height / 2 - bounds.top - bounds.height / 2,
            0,
        );

        mesh.material.uniforms.uImageSize.value.set(
            bounds.width,
            bounds.height,
        );
    });
}

resize();

window.addEventListener("resize", resize);

gsap.ticker.add(() => {
    syncPlanes();
    renderer.render(scene, camera);
});
