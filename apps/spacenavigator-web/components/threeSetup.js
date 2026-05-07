// src/threeSetup.js
import * as THREE from "three";

export function createScene() {
	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x000033, 0.008);
	return scene;
}

export function createCamera() {
	const camera = new THREE.PerspectiveCamera(
		75,
		window.innerWidth / window.innerHeight,
		0.1,
		3000
	);
	return camera;
}

export function createRenderer() {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x000022);
	document.body.appendChild(renderer.domElement);
	return renderer;
}

export function addLights(scene) {
	const ambientLight = new THREE.AmbientLight(0x222244);
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xaaccff, 1);
	directionalLight.position.set(5, 3, 5);
	scene.add(directionalLight);

	const engineLight = new THREE.PointLight(0x00ffff, 1, 10);
	engineLight.position.set(0, 0, 2);
	scene.add(engineLight);

	const dangerLight = new THREE.PointLight(0xff3333, 0, 50);
	scene.add(dangerLight);

	return { engineLight, dangerLight };
}
