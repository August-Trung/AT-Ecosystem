// src/background.js
import * as THREE from "three";

export function createStars(scene) {
	const starsGeometry = new THREE.BufferGeometry();
	const starsVertices = [];
	const starColors = [];

	for (let i = 0; i < 2000; i++) {
		const x = (Math.random() - 0.5) * 2000;
		const y = (Math.random() - 0.5) * 2000;
		const z = (Math.random() - 0.5) * 2000;
		starsVertices.push(x, y, z);

		const colorChoice = Math.random();
		if (colorChoice > 0.95) {
			starColors.push(1, 0.7, 0.7); // Red giants
		} else if (colorChoice > 0.9) {
			starColors.push(0.7, 0.7, 1); // Blue giants
		} else if (colorChoice > 0.8) {
			starColors.push(1, 1, 0.7); // Yellow stars
		} else {
			starColors.push(1, 1, 1); // White stars
		}
	}

	starsGeometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(starsVertices, 3)
	);
	starsGeometry.setAttribute(
		"color",
		new THREE.Float32BufferAttribute(starColors, 3)
	);

	const starsMaterial = new THREE.PointsMaterial({
		size: 0.2,
		vertexColors: true,
	});

	const stars = new THREE.Points(starsGeometry, starsMaterial);
	scene.add(stars);
	return stars;
}

export function createDistantObject(scene) {
	const size = Math.random() * 50 + 20;
	const geometry = new THREE.SphereGeometry(size, 32, 32);
	const hue = Math.random();
	const material = new THREE.MeshPhongMaterial({
		color: new THREE.Color().setHSL(hue, 0.7, 0.3),
		transparent: true,
		opacity: 0.3,
		side: THREE.DoubleSide,
	});
	const object = new THREE.Mesh(geometry, material);

	const angle = Math.random() * Math.PI * 2;
	const distance = Math.random() * 500 + 300;
	object.position.set(
		Math.cos(angle) * distance,
		(Math.random() - 0.5) * 200,
		Math.sin(angle) * distance
	);

	scene.add(object);
	return object;
}

export function createDistantObjects(scene, count = 5) {
	const distantObjects = [];
	for (let i = 0; i < count; i++) {
		distantObjects.push(createDistantObject(scene));
	}
	return distantObjects;
}
