// src/playerShip.js
import * as THREE from "three";

export function createShipGroup() {
	const shipGroup = new THREE.Group();

	// Main ship body
	const shipGeometry = new THREE.ConeGeometry(0.5, 2, 8);
	const shipMaterial = new THREE.MeshPhongMaterial({
		color: 0x3399ff,
		emissive: 0x112244,
		shininess: 100,
	});
	const ship = new THREE.Mesh(shipGeometry, shipMaterial);
	ship.rotation.x = Math.PI / 2;
	shipGroup.add(ship);

	// Ship wings
	const wingGeometry = new THREE.BoxGeometry(2, 0.1, 0.5);
	const wingMaterial = new THREE.MeshPhongMaterial({
		color: 0x2277cc,
		emissive: 0x001133,
	});
	const wings = new THREE.Mesh(wingGeometry, wingMaterial);
	wings.position.y = -0.3;
	shipGroup.add(wings);

	// Engine glow
	const engineGlowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
	const engineGlowMaterial = new THREE.MeshBasicMaterial({
		color: 0x00ffff,
		transparent: true,
		opacity: 0.7,
	});
	const engineGlow = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
	engineGlow.position.y = -1;
	shipGroup.add(engineGlow);

	return { shipGroup, ship, wings, engineGlow };
}
