import { createInputController } from "./components/controls.js";
import { createTutorialUI } from "./components/tutorial.js";

// Game state
let score = 0;
let level = 1;
let speed = 1;
let gameActive = false;
let gameOver = false;
let gamePaused = false;
let previousSpeed = 0;
const inputController = createInputController({
	shouldCapture: () => gameActive && !gamePaused && !gameOver,
});

const levelConfigs = [
	{
		id: 1,
		name: "Nebula Gate",
		startSpeed: 1.0,
		startScore: 0,
		startAsteroids: 8,
		targetScore: 1000,
		duration: 60,
	},
	{
		id: 2,
		name: "Ion Belt",
		startSpeed: 1.3,
		startScore: 1000,
		startAsteroids: 10,
		targetScore: 2000,
		duration: 75,
	},
	{
		id: 3,
		name: "Crimson Drift",
		startSpeed: 1.6,
		startScore: 2000,
		startAsteroids: 12,
		targetScore: 3000,
		duration: 90,
	},
	{
		id: 4,
		name: "Void Rift",
		startSpeed: 1.9,
		startScore: 3000,
		startAsteroids: 14,
		targetScore: 4000,
		duration: 105,
	},
	{
		id: 5,
		name: "Starforge",
		startSpeed: 2.2,
		startScore: 4000,
		startAsteroids: 16,
		targetScore: 5000,
		duration: 120,
	},
	{
		id: 6,
		name: "Astral Surge",
		startSpeed: 2.5,
		startScore: 5200,
		startAsteroids: 18,
		targetScore: 6200,
		duration: 135,
	},
	{
		id: 7,
		name: "Quasar Run",
		startSpeed: 2.8,
		startScore: 6500,
		startAsteroids: 20,
		targetScore: 7600,
		duration: 150,
	},
	{
		id: 8,
		name: "Hollow Eclipse",
		startSpeed: 3.1,
		startScore: 8000,
		startAsteroids: 22,
		targetScore: 9200,
		duration: 165,
	},
	{
		id: 9,
		name: "Gravemind Core",
		startSpeed: 3.4,
		startScore: 9600,
		startAsteroids: 24,
		targetScore: 11000,
		duration: 180,
	},
	{
		id: 10,
		name: "Eventide Crown",
		startSpeed: 3.7,
		startScore: 11600,
		startAsteroids: 26,
		targetScore: 13200,
		duration: 200,
	},
	{
		id: 11,
		name: "Helix Frontier",
		startSpeed: 4.0,
		startScore: 13600,
		startAsteroids: 28,
		targetScore: 15400,
		duration: 215,
	},
	{
		id: 12,
		name: "Auric Lattice",
		startSpeed: 4.3,
		startScore: 15800,
		startAsteroids: 30,
		targetScore: 17800,
		duration: 230,
	},
	{
		id: 13,
		name: "Nightglass",
		startSpeed: 4.6,
		startScore: 18200,
		startAsteroids: 32,
		targetScore: 20400,
		duration: 245,
	},
	{
		id: 14,
		name: "Cinder Relay",
		startSpeed: 4.9,
		startScore: 20800,
		startAsteroids: 34,
		targetScore: 23200,
		duration: 260,
	},
	{
		id: 15,
		name: "Orion Wake",
		startSpeed: 5.2,
		startScore: 23600,
		startAsteroids: 36,
		targetScore: 26200,
		duration: 275,
	},
	{
		id: 16,
		name: "Nova Barrens",
		startSpeed: 5.5,
		startScore: 26600,
		startAsteroids: 38,
		targetScore: 29400,
		duration: 290,
	},
	{
		id: 17,
		name: "Eclipse Hollow",
		startSpeed: 5.8,
		startScore: 29800,
		startAsteroids: 40,
		targetScore: 32800,
		duration: 305,
	},
	{
		id: 18,
		name: "Tempest Veil",
		startSpeed: 6.1,
		startScore: 33200,
		startAsteroids: 42,
		targetScore: 36400,
		duration: 320,
	},
	{
		id: 19,
		name: "Radiant Divide",
		startSpeed: 6.4,
		startScore: 36800,
		startAsteroids: 44,
		targetScore: 40200,
		duration: 335,
	},
	{
		id: 20,
		name: "Iron Parallax",
		startSpeed: 6.7,
		startScore: 40600,
		startAsteroids: 46,
		targetScore: 44200,
		duration: 350,
	},
	{
		id: 21,
		name: "Obsidian Reach",
		startSpeed: 7.0,
		startScore: 44600,
		startAsteroids: 48,
		targetScore: 48400,
		duration: 365,
	},
	{
		id: 22,
		name: "Voidstep",
		startSpeed: 7.3,
		startScore: 48800,
		startAsteroids: 50,
		targetScore: 52800,
		duration: 380,
	},
	{
		id: 23,
		name: "Hyperion Drift",
		startSpeed: 7.6,
		startScore: 53200,
		startAsteroids: 52,
		targetScore: 57400,
		duration: 395,
	},
	{
		id: 24,
		name: "Haze Meridian",
		startSpeed: 7.9,
		startScore: 57800,
		startAsteroids: 54,
		targetScore: 62200,
		duration: 410,
	},
	{
		id: 25,
		name: "Apex Spiral",
		startSpeed: 8.2,
		startScore: 62600,
		startAsteroids: 56,
		targetScore: 67200,
		duration: 425,
	},
	{
		id: 26,
		name: "Vortex Crown",
		startSpeed: 8.5,
		startScore: 67600,
		startAsteroids: 58,
		targetScore: 72400,
		duration: 440,
	},
	{
		id: 27,
		name: "Starlance",
		startSpeed: 8.8,
		startScore: 72800,
		startAsteroids: 60,
		targetScore: 77800,
		duration: 455,
	},
	{
		id: 28,
		name: "Helios Grave",
		startSpeed: 9.1,
		startScore: 78200,
		startAsteroids: 62,
		targetScore: 83400,
		duration: 470,
	},
	{
		id: 29,
		name: "Pulse Dominion",
		startSpeed: 9.4,
		startScore: 83800,
		startAsteroids: 64,
		targetScore: 89200,
		duration: 485,
	},
	{
		id: 30,
		name: "Singularity Rise",
		startSpeed: 9.7,
		startScore: 89600,
		startAsteroids: 66,
		targetScore: 95200,
		duration: 500,
	},
];

let selectedLevelIndex = 0;
let currentLevelConfig = levelConfigs[0];
let levelStartTime = 0;
let stageCleared = false;
let stageAutoAdvanceTimer = null;
const stageModeActive = true;

// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	3000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000022);
document.body.appendChild(renderer.domElement);
const clock = new THREE.Clock();

// Fog for dramatic depth effect
scene.fog = new THREE.FogExp2(0x000033, 0.008);

// Lighting
const ambientLight = new THREE.AmbientLight(0x222244);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xaaccff, 1);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

// Dynamic point lights
const engineLight = new THREE.PointLight(0x00ffff, 1, 10);
engineLight.position.set(0, 0, 2);
scene.add(engineLight);

const dangerLight = new THREE.PointLight(0xff3333, 0, 50);
scene.add(dangerLight);

// Stars background - enhanced with different sizes and colors
const starsGeometry = new THREE.BufferGeometry();
const starsVertices = [];
const starColors = [];

for (let i = 0; i < 2000; i++) {
	const x = (Math.random() - 0.5) * 2000;
	const y = (Math.random() - 0.5) * 2000;
	const z = (Math.random() - 0.5) * 2000;
	starsVertices.push(x, y, z);

	// Different star colors
	const colorChoice = Math.random();
	if (colorChoice > 0.95) {
		// Red giants
		starColors.push(1, 0.7, 0.7);
	} else if (colorChoice > 0.9) {
		// Blue giants
		starColors.push(0.7, 0.7, 1);
	} else if (colorChoice > 0.8) {
		// Yellow stars
		starColors.push(1, 1, 0.7);
	} else {
		// White stars
		starColors.push(1, 1, 1);
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

console.log("Camera position:", camera.position);
console.log("Camera lookAt:", camera.getWorldDirection(new THREE.Vector3()));

const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// Distant space objects (planets, nebulae)
function createDistantObject() {
	const size = Math.random() * 50 + 20;
	const geometry = new THREE.SphereGeometry(size, 32, 32);

	// Random color for the nebula/planet
	const hue = Math.random();
	const material = new THREE.MeshPhongMaterial({
		color: new THREE.Color().setHSL(hue, 0.7, 0.3),
		transparent: true,
		opacity: 0.3,
		side: THREE.DoubleSide,
	});

	const object = new THREE.Mesh(geometry, material);

	// Position far away
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

// Create some distant objects
const distantObjects = [];
for (let i = 0; i < 5; i++) {
	distantObjects.push(createDistantObject());
}

// Player spaceship - enhanced with more details
const shipGroup = new THREE.Group();
scene.add(shipGroup);

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

const shipDetailMaterial = new THREE.MeshPhongMaterial({
	color: 0x2277cc,
	emissive: 0x001133,
	shininess: 80,
});

const decalMaterial = new THREE.MeshBasicMaterial({
	color: 0x66ccff,
	transparent: true,
	opacity: 0.7,
});

// Ship wings
const wingGeometry = new THREE.BoxGeometry(2, 0.1, 0.5);
const wingMaterial = shipDetailMaterial;
const wings = new THREE.Mesh(wingGeometry, wingMaterial);
wings.position.y = -0.3;
shipGroup.add(wings);

const noseGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
const nose = new THREE.Mesh(noseGeometry, shipDetailMaterial);
nose.position.z = 1.2;
nose.rotation.x = Math.PI / 2;
shipGroup.add(nose);

const tailGeometry = new THREE.ConeGeometry(0.35, 0.7, 8);
const tail = new THREE.Mesh(tailGeometry, shipDetailMaterial);
tail.position.z = -1.1;
tail.rotation.x = Math.PI / 2;
shipGroup.add(tail);

const weaponGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
const weaponLeft = new THREE.Mesh(weaponGeometry, shipDetailMaterial);
const weaponRight = new THREE.Mesh(weaponGeometry, shipDetailMaterial);
weaponLeft.rotation.z = Math.PI / 2;
weaponRight.rotation.z = Math.PI / 2;
weaponLeft.position.set(-0.8, -0.1, 0.35);
weaponRight.position.set(0.8, -0.1, 0.35);
shipGroup.add(weaponLeft);
shipGroup.add(weaponRight);

const decalGeometry = new THREE.PlaneGeometry(0.8, 0.3);
const decal = new THREE.Mesh(decalGeometry, decalMaterial);
decal.position.set(0, 0.25, 0.2);
decal.rotation.x = -Math.PI / 2;
shipGroup.add(decal);

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

// Ship customization system
const shipCustomizations = {
	colors: [
		{
			name: "Classic Blue",
			primary: 0x3399ff,
			secondary: 0x2277cc,
			unlocked: true,
		},
		{
			name: "Crimson Fury",
			primary: 0xff3333,
			secondary: 0xcc2222,
			unlocked: true,
		},
		{
			name: "Emerald Strike",
			primary: 0x33cc66,
			secondary: 0x228844,
			unlocked: true,
		},
		{
			name: "Purple Haze",
			primary: 0x9966ff,
			secondary: 0x7744cc,
			unlocked: false,
			cost: 500,
		},
		{
			name: "Golden Phoenix",
			primary: 0xffcc00,
			secondary: 0xcc9900,
			unlocked: false,
			cost: 800,
		},
	],

	wings: [
		{
			name: "Standard",
			scale: { x: 1.0, y: 1.0 },
			geometry: "BoxGeometry",
			unlocked: true,
		},
		{
			name: "Wide",
			scale: { x: 1.5, y: 0.8 },
			geometry: "BoxGeometry",
			unlocked: true,
		},
		{
			name: "Delta",
			scale: { x: 1.2, y: 1.2 },
			geometry: "ConeGeometry",
			unlocked: false,
			cost: 700,
		},
		{
			name: "Dagger",
			scale: { x: 0.8, y: 1.8 },
			geometry: "BoxGeometry",
			unlocked: false,
			cost: 900,
		},
	],

	engineEffects: [
		{
			name: "Blue Flame",
			color: 0x00ffff,
			intensity: 1.0,
			trailColor: 0x66f7ff,
			trailSize: 0.18,
			trailOpacity: 0.7,
			unlocked: true,
		},
		{
			name: "Plasma Burn",
			color: 0xff00ff,
			intensity: 1.2,
			trailColor: 0xff66ff,
			trailSize: 0.2,
			trailOpacity: 0.75,
			unlocked: false,
			cost: 900,
		},
		{
			name: "Solar Flare",
			color: 0xffaa00,
			intensity: 1.5,
			trailColor: 0xffcc66,
			trailSize: 0.22,
			trailOpacity: 0.8,
			unlocked: false,
			cost: 1500,
		},
	],

	noses: [
		{
			name: "Spear",
			shape: "Cone",
			scale: { x: 0.4, y: 0.9, z: 0.4 },
			offsetZ: 1.2,
			unlocked: true,
			cost: 0,
		},
		{
			name: "Ram",
			shape: "Box",
			scale: { x: 0.5, y: 0.4, z: 0.7 },
			offsetZ: 1.05,
			unlocked: false,
			cost: 600,
		},
		{
			name: "Spike",
			shape: "Cylinder",
			scale: { x: 0.25, y: 0.8, z: 0.25 },
			offsetZ: 1.25,
			unlocked: false,
			cost: 1400,
		},
	],

	tails: [
		{
			name: "Fin",
			shape: "Box",
			scale: { x: 0.4, y: 0.5, z: 0.6 },
			offsetZ: -1.1,
			unlocked: true,
			cost: 0,
		},
		{
			name: "Split",
			shape: "Cylinder",
			scale: { x: 0.3, y: 0.6, z: 0.3 },
			offsetZ: -1.2,
			unlocked: false,
			cost: 800,
		},
		{
			name: "Stinger",
			shape: "Cone",
			scale: { x: 0.35, y: 0.9, z: 0.35 },
			offsetZ: -1.35,
			unlocked: false,
			cost: 1800,
		},
	],

	weapons: [
		{
			name: "Twin Cannons",
			shape: "Cylinder",
			scale: { x: 0.15, y: 0.6, z: 0.15 },
			offset: { x: 0.8, y: -0.1, z: 0.35 },
			unlocked: true,
			cost: 0,
		},
		{
			name: "Pulse Pods",
			shape: "Box",
			scale: { x: 0.2, y: 0.4, z: 0.4 },
			offset: { x: 0.9, y: -0.05, z: 0.2 },
			unlocked: false,
			cost: 900,
		},
		{
			name: "Rail Lances",
			shape: "Cylinder",
			scale: { x: 0.12, y: 0.9, z: 0.12 },
			offset: { x: 0.95, y: -0.1, z: 0.5 },
			unlocked: false,
			cost: 2000,
		},
	],

	decals: [
		{
			name: "None",
			style: "None",
			color: 0x000000,
			opacity: 0,
			unlocked: true,
			cost: 0,
		},
		{
			name: "Stripe",
			style: "Stripe",
			color: 0x66ccff,
			opacity: 0.8,
			unlocked: false,
			cost: 500,
		},
		{
			name: "Chevron",
			style: "Chevron",
			color: 0xffcc66,
			opacity: 0.9,
			unlocked: false,
			cost: 900,
		},
	],

	finishes: [
		{
			name: "Matte",
			shininess: 20,
			emissiveIntensity: 0.3,
			unlocked: true,
			cost: 0,
		},
		{
			name: "Gloss",
			shininess: 120,
			emissiveIntensity: 0.5,
			unlocked: false,
			cost: 700,
		},
		{
			name: "Neon",
			shininess: 200,
			emissiveIntensity: 0.9,
			unlocked: false,
			cost: 1600,
		},
	],

	trails: [
		{
			name: "Ion",
			color: 0x66f7ff,
			size: 0.18,
			opacity: 0.7,
			unlocked: true,
			cost: 0,
		},
		{
			name: "Comet",
			color: 0xffcc66,
			size: 0.22,
			opacity: 0.8,
			unlocked: false,
			cost: 1000,
		},
		{
			name: "Nova",
			color: 0xff66ff,
			size: 0.24,
			opacity: 0.85,
			unlocked: false,
			cost: 2000,
		},
	],

	shipTypes: [
		{
			name: "Scout",
			shape: "Cone",
			scale: 1,
			offsets: {
				nose: 1.2,
				tail: -1.1,
			},
			unlocked: true,
			cost: 0,
		},
		{
			name: "Interceptor",
			shape: "Cylinder",
			scale: 1.1,
			offsets: {
				nose: 1.3,
				tail: -1.15,
			},
			unlocked: true,
			cost: 0,
		},
		{
			name: "Bulwark",
			shape: "Box",
			scale: 1.2,
			offsets: {
				nose: 1.1,
				tail: -1.2,
			},
			unlocked: false,
			cost: 1200,
		},
		{
			name: "Raptor",
			shape: "Octahedron",
			scale: 1.05,
			offsets: {
				nose: 1.25,
				tail: -1.2,
			},
			unlocked: false,
			cost: 2200,
		},
		{
			name: "Phantom",
			shape: "Torus",
			scale: 1.1,
			offsets: {
				nose: 1.0,
				tail: -1.0,
			},
			unlocked: false,
			cost: 3500,
		},
	],

	lightingPresets: [
		{
			name: "Nebula",
			ambient: 0x223344,
			key: 0x9be8ff,
			intensity: 1.2,
		},
		{
			name: "Warm Dock",
			ambient: 0x332211,
			key: 0xffcc88,
			intensity: 1.1,
		},
		{
			name: "Cold Forge",
			ambient: 0x112233,
			key: 0x66b3ff,
			intensity: 1.3,
		},
	],
};

const skinCatalog = [
	{
		id: "none",
		name: "No Skin",
		rarity: "Common",
		unlocked: true,
		tags: [],
		data: null,
	},
	{
		id: "aurora",
		name: "Aurora Drift",
		rarity: "Rare",
		unlocked: true,
		tags: ["aurora", "nebula", "frost"],
		data: {
			colorIndex: 2,
			engineIndex: 1,
			finishIndex: 2,
			trailIndex: 2,
			decalIndex: 1,
			lightingIndex: 0,
		},
	},
	{
		id: "starbound",
		name: "Starbound",
		rarity: "Common",
		unlocked: false,
		tags: ["stellar", "nebula"],
		data: {
			colorIndex: 0,
			engineIndex: 0,
			finishIndex: 0,
			trailIndex: 0,
			decalIndex: 0,
			lightingIndex: 0,
		},
	},
	{
		id: "embercrest",
		name: "Embercrest",
		rarity: "Common",
		unlocked: false,
		tags: ["ember", "solar"],
		data: {
			colorIndex: 1,
			engineIndex: 0,
			finishIndex: 1,
			trailIndex: 0,
			decalIndex: 1,
			lightingIndex: 1,
		},
	},
	{
		id: "emberline",
		name: "Emberline",
		rarity: "Epic",
		unlocked: false,
		tags: ["ember", "solar", "flare"],
		data: {
			colorIndex: 4,
			engineIndex: 2,
			finishIndex: 2,
			trailIndex: 1,
			decalIndex: 2,
			lightingIndex: 1,
		},
	},
	{
		id: "ghostwave",
		name: "Ghostwave",
		rarity: "Rare",
		unlocked: false,
		tags: ["void", "harvest"],
		data: {
			colorIndex: 3,
			engineIndex: 1,
			finishIndex: 1,
			trailIndex: 0,
			decalIndex: 1,
			lightingIndex: 2,
		},
	},
	{
		id: "neonflare",
		name: "Neon Flare",
		rarity: "Epic",
		unlocked: false,
		tags: ["nebula", "flare", "stellar"],
		data: {
			colorIndex: 4,
			engineIndex: 2,
			finishIndex: 2,
			trailIndex: 2,
			decalIndex: 2,
			lightingIndex: 0,
		},
	},
	{
		id: "voidsteel",
		name: "Voidsteel",
		rarity: "Mythic",
		unlocked: false,
		tags: ["void", "eclipse"],
		data: {
			colorIndex: 0,
			engineIndex: 2,
			finishIndex: 2,
			trailIndex: 2,
			decalIndex: 2,
			lightingIndex: 2,
			shipTypeIndex: 3,
			wingIndex: 3,
		},
	},
	{
		id: "ionstorm",
		name: "Ionstorm",
		rarity: "Rare",
		unlocked: false,
		tags: ["nebula", "stellar"],
		data: {
			colorIndex: 2,
			engineIndex: 1,
			finishIndex: 1,
			trailIndex: 1,
			decalIndex: 2,
			lightingIndex: 2,
		},
	},
	{
		id: "crystalveil",
		name: "Crystal Veil",
		rarity: "Rare",
		unlocked: false,
		tags: ["frost", "aurora"],
		data: {
			colorIndex: 0,
			engineIndex: 1,
			finishIndex: 2,
			trailIndex: 2,
			decalIndex: 1,
			lightingIndex: 0,
		},
	},
	{
		id: "sunflare",
		name: "Sunflare",
		rarity: "Epic",
		unlocked: false,
		tags: ["solar", "flare"],
		data: {
			colorIndex: 4,
			engineIndex: 2,
			finishIndex: 2,
			trailIndex: 1,
			decalIndex: 2,
			lightingIndex: 1,
		},
	},
	{
		id: "nightshift",
		name: "Nightshift",
		rarity: "Epic",
		unlocked: false,
		tags: ["void", "eclipse"],
		data: {
			colorIndex: 3,
			engineIndex: 2,
			finishIndex: 1,
			trailIndex: 2,
			decalIndex: 1,
			lightingIndex: 2,
		},
	},
	{
		id: "gravemaw",
		name: "Gravemaw",
		rarity: "Mythic",
		unlocked: false,
		tags: ["eclipse", "void"],
		data: {
			colorIndex: 1,
			engineIndex: 2,
			finishIndex: 2,
			trailIndex: 2,
			decalIndex: 2,
			lightingIndex: 2,
			shipTypeIndex: 2,
			wingIndex: 2,
		},
	},
	{
		id: "solstice",
		name: "Solstice Crown",
		rarity: "Mythic",
		unlocked: false,
		tags: ["solar", "stellar"],
		data: {
			colorIndex: 4,
			engineIndex: 2,
			finishIndex: 2,
			trailIndex: 2,
			decalIndex: 2,
			lightingIndex: 1,
			shipTypeIndex: 1,
			wingIndex: 1,
		},
	},
];

const gachaTable = [
	{ rarity: "Common", weight: 60 },
	{ rarity: "Rare", weight: 25 },
	{ rarity: "Epic", weight: 12 },
	{ rarity: "Mythic", weight: 3 },
];

const seasonalThemes = [
	{
		id: "stellar-bloom",
		name: "Stellar Bloom",
		months: [2, 3, 4],
		tags: ["nebula", "aurora", "stellar", "bloom"],
	},
	{
		id: "solar-tide",
		name: "Solar Tide",
		months: [5, 6, 7],
		tags: ["solar", "ember", "flare"],
	},
	{
		id: "void-harvest",
		name: "Void Harvest",
		months: [8, 9, 10],
		tags: ["void", "harvest", "eclipse"],
	},
	{
		id: "crystal-drift",
		name: "Crystal Drift",
		months: [11, 0, 1],
		tags: ["frost", "aurora", "crystal"],
	},
];

const gachaPity = {
	epic: 8,
	mythic: 20,
};

const skinPacks = [
	{
		id: "bronze",
		name: "Bronze Pack",
		cost: 600,
		minRarity: "Common",
		bonus: { Rare: 1, Epic: 0, Mythic: 0 },
		rolls: 2,
		bonusRewards: {
			creditsMin: 80,
			creditsMax: 140,
			unlockChance: 0.2,
			presetSlotChance: 0.05,
		},
	},
	{
		id: "silver",
		name: "Silver Pack",
		cost: 1200,
		minRarity: "Rare",
		bonus: { Rare: 4, Epic: 2, Mythic: 0 },
		rolls: 3,
		bonusRewards: {
			creditsMin: 180,
			creditsMax: 260,
			unlockChance: 0.35,
			presetSlotChance: 0.1,
		},
	},
	{
		id: "gold",
		name: "Gold Pack",
		cost: 2200,
		minRarity: "Epic",
		bonus: { Rare: 6, Epic: 4, Mythic: 2 },
		rolls: 5,
		bonusRewards: {
			creditsMin: 350,
			creditsMax: 500,
			unlockChance: 0.5,
			presetSlotChance: 0.2,
		},
	},
];

let customizationSelection = null;
let unlockStore = null;
let shipUnlocks = null;
let credits = 0;
let ownedSkins = null;
let gachaState = null;

function buildUnlockMap(items, stored) {
	const unlocks = {};
	items.forEach((item, index) => {
		unlocks[index] = Boolean((stored && stored[index]) || item.unlocked);
	});
	return unlocks;
}

function loadUnlockStore() {
	let stored = {};
	let legacyShipUnlocks = {};
	try {
		stored = JSON.parse(localStorage.getItem("shipUnlocksV2")) || {};
		legacyShipUnlocks =
			JSON.parse(localStorage.getItem("shipUnlocks")) || {};
	} catch (e) {
		stored = {};
		legacyShipUnlocks = {};
	}

	const store = {
		shipTypes: buildUnlockMap(
			shipCustomizations.shipTypes,
			stored.shipTypes || legacyShipUnlocks
		),
		noses: buildUnlockMap(shipCustomizations.noses, stored.noses),
		tails: buildUnlockMap(shipCustomizations.tails, stored.tails),
		weapons: buildUnlockMap(shipCustomizations.weapons, stored.weapons),
		decals: buildUnlockMap(shipCustomizations.decals, stored.decals),
		finishes: buildUnlockMap(
			shipCustomizations.finishes,
			stored.finishes
		),
		trails: buildUnlockMap(shipCustomizations.trails, stored.trails),
		engineEffects: buildUnlockMap(
			shipCustomizations.engineEffects,
			stored.engineEffects
		),
		wings: buildUnlockMap(shipCustomizations.wings, stored.wings),
		colors: buildUnlockMap(shipCustomizations.colors, stored.colors),
	};

	try {
		localStorage.setItem("shipUnlocksV2", JSON.stringify(store));
	} catch (e) {
		// Storage unavailable (e.g. file://); keep in-memory.
	}

	return store;
}

function saveUnlockStore() {
	if (!unlockStore) return;
	try {
		localStorage.setItem("shipUnlocksV2", JSON.stringify(unlockStore));
	} catch (e) {
		// Ignore storage failures.
	}
}

function isUnlocked(category, index) {
	return Boolean(unlockStore && unlockStore[category][index]);
}

function unlockItem(category, index) {
	if (!unlockStore) return;
	unlockStore[category][index] = true;
	saveUnlockStore();
}

function loadShipUnlocks() {
	unlockStore = loadUnlockStore();
	shipUnlocks = unlockStore.shipTypes;
	return shipUnlocks;
}

function saveShipUnlocks() {
	saveUnlockStore();
}

function isShipTypeUnlocked(index) {
	return isUnlocked("shipTypes", index);
}

function unlockShipType(index) {
	unlockItem("shipTypes", index);
}

function loadCredits() {
	try {
		const value = Number(localStorage.getItem("playerCredits") || "0");
		return Number.isFinite(value) ? Math.floor(value) : 0;
	} catch (e) {
		return 0;
	}
}

function loadOwnedSkins() {
	let stored = [];
	try {
		stored = JSON.parse(localStorage.getItem("ownedSkins")) || [];
	} catch (e) {
		stored = [];
	}

	const unlocked = new Set();
	skinCatalog.forEach((skin) => {
		if (skin.unlocked) {
			unlocked.add(skin.id);
		}
	});

	stored.forEach((id) => unlocked.add(id));
	const list = Array.from(unlocked);

	try {
		localStorage.setItem("ownedSkins", JSON.stringify(list));
	} catch (e) {
		// Ignore storage failures.
	}

	return list;
}

function saveOwnedSkins() {
	if (!ownedSkins) return;
	try {
		localStorage.setItem("ownedSkins", JSON.stringify(ownedSkins));
	} catch (e) {
		// Ignore storage failures.
	}
}

function getActiveTheme() {
	const month = new Date().getMonth();
	return (
		seasonalThemes.find((theme) =>
			theme.months.includes(month)
		) || null
	);
}

function loadGachaState() {
	try {
		return (
			JSON.parse(localStorage.getItem("gachaState")) || {
				sinceEpic: 0,
				sinceMythic: 0,
				totalRolls: 0,
			}
		);
	} catch (e) {
		return { sinceEpic: 0, sinceMythic: 0, totalRolls: 0 };
	}
}

function saveGachaState(state) {
	localStorage.setItem("gachaState", JSON.stringify(state));
}

function getPresetLimit() {
	try {
		return Number(localStorage.getItem("presetLimit") || "12");
	} catch (e) {
		return 12;
	}
}

function setPresetLimit(limit) {
	localStorage.setItem("presetLimit", String(limit));
}

function isSkinOwned(id) {
	return Boolean(ownedSkins && ownedSkins.includes(id));
}

function unlockSkin(id) {
	if (!ownedSkins) {
		ownedSkins = [];
	}
	if (!ownedSkins.includes(id)) {
		ownedSkins.push(id);
		saveOwnedSkins();
	}
}

function getSkinById(id) {
	return skinCatalog.find((skin) => skin.id === id);
}

function getRarityOrder(rarity) {
	const order = ["Common", "Rare", "Epic", "Mythic"];
	const index = order.indexOf(rarity);
	return index >= 0 ? index : 0;
}

function getRarityClass(rarity) {
	return `rarity-${rarity.toLowerCase()}`;
}

function setCredits(value) {
	credits = Math.max(0, Math.floor(value));
	try {
		localStorage.setItem("playerCredits", String(credits));
	} catch (e) {
		// Ignore storage failures.
	}
	updateCreditsUI();
}

function addCredits(value) {
	setCredits(credits + Math.floor(value));
}

function updateCreditsUI() {
	const creditsEl = document.getElementById("shipCredits");
	if (creditsEl) {
		creditsEl.textContent = `Credits: ${credits}`;
	}
}

function loadHighScores() {
	try {
		return JSON.parse(localStorage.getItem("highScores")) || [];
	} catch (e) {
		return [];
	}
}

function saveHighScores(list) {
	localStorage.setItem("highScores", JSON.stringify(list));
}

function recordHighScore(entry) {
	const list = loadHighScores();
	list.push(entry);
	list.sort((a, b) => b.score - a.score);
	const trimmed = list.slice(0, 5);
	saveHighScores(trimmed);
	return trimmed[0] && trimmed[0].score === entry.score;
}

function renderLeaderboard() {
	const list = loadHighScores();
	const panels = [
		document.getElementById("leaderboardPanel"),
		document.getElementById("gameOverLeaderboard"),
	].filter(Boolean);

	const content = `
		<div class="leaderboard-title">Top Pilots</div>
		<div class="leaderboard-list">
			${
				list.length
					? list
							.map((entry, index) => {
								const levelLabel =
									typeof entry.level === "number"
										? `L${entry.level}`
										: "L--";
								return `<div class="leaderboard-item">
										<div>#${index + 1} · ${levelLabel}</div>
										<span>${entry.score}</span>
									</div>`;
							})
							.join("")
					: '<div class="leaderboard-item"><div>No records yet</div><span>--</span></div>'
			}
		</div>
	`;

	panels.forEach((panel) => {
		panel.innerHTML = content;
	});

	const bestScore = document.getElementById("bestScore");
	if (bestScore) {
		bestScore.textContent = list.length ? String(list[0].score) : "0";
	}
}

function canAfford(cost) {
	return credits >= cost;
}

function purchaseItem(category, index, cost) {
	if (cost <= 0) {
		unlockItem(category, index);
		return true;
	}
	if (!canAfford(cost)) {
		showNotification(`Not enough credits! Need ${cost}.`);
		return false;
	}
	setCredits(credits - cost);
	if (category !== "gacha") {
		unlockItem(category, index);
	}
	return true;
}

function getFirstUnlockedShipTypeIndex() {
	for (let i = 0; i < shipCustomizations.shipTypes.length; i++) {
		if (isShipTypeUnlocked(i)) return i;
	}
	return 0;
}

function normalizeSelection(selection) {
	const normalized = {
		colorIndex: selection.colorIndex,
		wingIndex: selection.wingIndex,
		engineIndex: selection.engineIndex,
		shipTypeIndex: selection.shipTypeIndex,
		noseIndex: selection.noseIndex,
		tailIndex: selection.tailIndex,
		weaponIndex: selection.weaponIndex,
		decalIndex: selection.decalIndex,
		finishIndex: selection.finishIndex,
		trailIndex: selection.trailIndex,
		lightingIndex: selection.lightingIndex,
		skinId: selection.skinId,
		autoRotate: selection.autoRotate,
		rotateSpeed: selection.rotateSpeed,
		zoomLevel: selection.zoomLevel,
	};

	function clampIndex(value, length, fallback) {
		if (typeof value !== "number") return fallback;
		if (value < 0 || value >= length) return fallback;
		return value;
	}

	normalized.colorIndex = clampIndex(
		normalized.colorIndex,
		shipCustomizations.colors.length,
		0
	);
	if (!isUnlocked("colors", normalized.colorIndex)) {
		normalized.colorIndex = 0;
	}

	normalized.wingIndex = clampIndex(
		normalized.wingIndex,
		shipCustomizations.wings.length,
		0
	);
	if (!isUnlocked("wings", normalized.wingIndex)) {
		normalized.wingIndex = 0;
	}

	normalized.engineIndex = clampIndex(
		normalized.engineIndex,
		shipCustomizations.engineEffects.length,
		0
	);
	if (!isUnlocked("engineEffects", normalized.engineIndex)) {
		normalized.engineIndex = 0;
	}

	normalized.shipTypeIndex = clampIndex(
		normalized.shipTypeIndex,
		shipCustomizations.shipTypes.length,
		getFirstUnlockedShipTypeIndex()
	);
	if (!isUnlocked("shipTypes", normalized.shipTypeIndex)) {
		normalized.shipTypeIndex = getFirstUnlockedShipTypeIndex();
	}

	normalized.noseIndex = clampIndex(
		normalized.noseIndex,
		shipCustomizations.noses.length,
		0
	);
	if (!isUnlocked("noses", normalized.noseIndex)) {
		normalized.noseIndex = 0;
	}

	normalized.tailIndex = clampIndex(
		normalized.tailIndex,
		shipCustomizations.tails.length,
		0
	);
	if (!isUnlocked("tails", normalized.tailIndex)) {
		normalized.tailIndex = 0;
	}

	normalized.weaponIndex = clampIndex(
		normalized.weaponIndex,
		shipCustomizations.weapons.length,
		0
	);
	if (!isUnlocked("weapons", normalized.weaponIndex)) {
		normalized.weaponIndex = 0;
	}

	normalized.decalIndex = clampIndex(
		normalized.decalIndex,
		shipCustomizations.decals.length,
		0
	);
	if (!isUnlocked("decals", normalized.decalIndex)) {
		normalized.decalIndex = 0;
	}

	normalized.finishIndex = clampIndex(
		normalized.finishIndex,
		shipCustomizations.finishes.length,
		0
	);
	if (!isUnlocked("finishes", normalized.finishIndex)) {
		normalized.finishIndex = 0;
	}

	normalized.trailIndex = clampIndex(
		normalized.trailIndex,
		shipCustomizations.trails.length,
		0
	);
	if (!isUnlocked("trails", normalized.trailIndex)) {
		normalized.trailIndex = 0;
	}

	normalized.lightingIndex = clampIndex(
		normalized.lightingIndex,
		shipCustomizations.lightingPresets.length,
		0
	);

	if (!normalized.skinId) {
		normalized.skinId = "none";
	}
	if (!isSkinOwned(normalized.skinId)) {
		normalized.skinId = "none";
	}

	normalized.autoRotate = Boolean(normalized.autoRotate);
	normalized.rotateSpeed =
		typeof normalized.rotateSpeed === "number"
			? Math.max(0, Math.min(1, normalized.rotateSpeed))
			: 0.4;
	normalized.zoomLevel =
		typeof normalized.zoomLevel === "number"
			? Math.max(2.5, Math.min(7, normalized.zoomLevel))
			: 4.2;

	return normalized;
}

const progressionMilestones = [
	{ level: 2, reward: { category: "noses", index: 1 } },
	{ level: 3, reward: { category: "tails", index: 1 } },
	{ level: 4, reward: { category: "weapons", index: 1 } },
	{ level: 5, reward: { category: "finishes", index: 1 } },
	{ level: 6, reward: { category: "trails", index: 1 } },
	{ level: 7, reward: { category: "shipTypes", index: 2 } },
	{ level: 8, reward: { category: "decals", index: 2 } },
];

function loadProgressionState() {
	try {
		return JSON.parse(localStorage.getItem("progressionUnlocks")) || {};
	} catch (e) {
		return {};
	}
}

function saveProgressionState(state) {
	localStorage.setItem("progressionUnlocks", JSON.stringify(state));
}

function checkLevelUnlocks(currentLevel) {
	const state = loadProgressionState();
	let unlockedAny = false;

	progressionMilestones.forEach((milestone) => {
		if (currentLevel < milestone.level) return;
		if (state[milestone.level]) return;

		state[milestone.level] = true;
		unlockItem(milestone.reward.category, milestone.reward.index);
		unlockedAny = true;
		showNotification(
			`Unlocked new part at Level ${milestone.level}!`
		);
	});

	if (unlockedAny) {
		saveProgressionState(state);
	}
}

function createShipBodyGeometry(type) {
	if (!type) return null;
	switch (type.shape) {
		case "Cone":
			return new THREE.ConeGeometry(0.5, 2, 8);
		case "Cylinder":
			return new THREE.CylinderGeometry(0.3, 0.6, 2, 10);
		case "Box":
			return new THREE.BoxGeometry(1.2, 0.7, 2);
		case "Octahedron":
			return new THREE.OctahedronGeometry(0.9);
		case "Torus":
			return new THREE.TorusGeometry(0.6, 0.2, 10, 16);
		default:
			return new THREE.ConeGeometry(0.5, 2, 8);
	}
}

function createAttachmentGeometry(shape, scale) {
	let geometry = null;
	switch (shape) {
		case "Cone":
			geometry = new THREE.ConeGeometry(0.5, 1, 8);
			break;
		case "Cylinder":
			geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 10);
			break;
		case "Box":
			geometry = new THREE.BoxGeometry(1, 0.5, 1);
			break;
		default:
			geometry = new THREE.BoxGeometry(1, 0.5, 1);
	}

	if (scale && geometry) {
		geometry.scale(scale.x, scale.y, scale.z);
	}
	return geometry;
}

function initializeCustomizationState() {
	if (!unlockStore) {
		shipUnlocks = loadShipUnlocks();
	}
	if (!credits) {
		credits = loadCredits();
	}
	if (!ownedSkins) {
		ownedSkins = loadOwnedSkins();
	}
	if (!gachaState) {
		gachaState = loadGachaState();
	}
}

function syncOptionSelection(selector, selectedValue) {
	const options = document.querySelectorAll(selector);
	for (const option of options) {
		const dataValue = option.dataset.index;
		const normalized =
			typeof selectedValue === "string"
				? selectedValue
				: String(selectedValue);
		const isSelected = dataValue === normalized;
		option.classList.toggle("option-card--selected", isSelected);
	}
}

function applySelectionToUI() {
	if (!customizationSelection) return;
	syncOptionSelection(".color-option", customizationSelection.colorIndex);
	syncOptionSelection(".wing-option", customizationSelection.wingIndex);
	syncOptionSelection(".engine-option", customizationSelection.engineIndex);
	syncOptionSelection(
		".shiptype-option",
		customizationSelection.shipTypeIndex
	);
	syncOptionSelection(".nose-option", customizationSelection.noseIndex);
	syncOptionSelection(".tail-option", customizationSelection.tailIndex);
	syncOptionSelection(
		".weapon-option",
		customizationSelection.weaponIndex
	);
	syncOptionSelection(".decal-option", customizationSelection.decalIndex);
	syncOptionSelection(
		".finish-option",
		customizationSelection.finishIndex
	);
	syncOptionSelection(".trail-option", customizationSelection.trailIndex);
	syncOptionSelection(".skin-option", customizationSelection.skinId);
	updateShipPreview(
		customizationSelection.colorIndex,
		customizationSelection.wingIndex,
		customizationSelection.engineIndex,
		customizationSelection.shipTypeIndex,
		customizationSelection.noseIndex,
		customizationSelection.tailIndex,
		customizationSelection.weaponIndex,
		customizationSelection.decalIndex,
		customizationSelection.finishIndex,
		customizationSelection.trailIndex,
		customizationSelection.lightingIndex
	);
	applyShowroomSettings();
	populateShopPanel();
}

function loadCustomizationSelection() {
	const saved = normalizeSelection(getCustomizationPreferences());
	customizationSelection = { ...saved };
	applySelectionToUI();
}

function openCustomizationScreen() {
	const screen = document.getElementById("customizeScreen");
	if (!screen) return;
	screen.style.display = "flex";
	if (!window.previewElements) {
		if (typeof THREE !== "undefined") {
			setupShipPreview();
		}
	}
	populateCustomizationOptions();
	loadCustomizationSelection();
	setActiveTab("parts");
	updateCreditsUI();
	requestAnimationFrame(refreshShipPreviewSize);
}

function updateLevelBadge() {
	const badge = document.getElementById("levelBadge");
	const level = levelConfigs[selectedLevelIndex] || levelConfigs[0];
	if (badge && level) {
		badge.textContent = `Selected: Level ${level.id} - ${level.name}`;
	}
}

function renderLevelOptions() {
	const container = document.getElementById("levelOptions");
	if (!container) return;
	container.innerHTML = "";

	levelConfigs.forEach((level, index) => {
		const card = document.createElement("div");
		card.className = "level-card";
		if (index === selectedLevelIndex) {
			card.classList.add("active");
		}

		card.innerHTML = `
			<div class="level-title">Level ${level.id} · ${level.name}</div>
			<div class="level-meta">Start Speed: ${level.startSpeed.toFixed(
				1
			)}x</div>
			<div class="level-meta">Asteroids: ${level.startAsteroids}</div>
			<div class="level-meta">Target Score: ${level.targetScore}</div>
			<div class="level-meta">Survive: ${level.duration}s</div>
		`;

		card.addEventListener("click", () => {
			selectedLevelIndex = index;
			updateLevelBadge();
			renderLevelOptions();
		});

		container.appendChild(card);
	});
}

function openLevelSelect() {
	const panel = document.getElementById("levelSelect");
	if (!panel) return;
	panel.style.display = "flex";
	renderLevelOptions();
}

function closeLevelSelect() {
	const panel = document.getElementById("levelSelect");
	if (!panel) return;
	panel.style.display = "none";
}

// UI for ship customization
function createCustomizationScreen() {
	const customizeScreen = document.createElement("div");
	customizeScreen.id = "customizeScreen";
	customizeScreen.className = "customize-screen";

	customizeScreen.innerHTML = `
        <div class="custom-header">
            <div>
                <h2 class="custom-title">Ship Lab</h2>
                <div class="custom-subtitle">Build. Tune. Dominate.</div>
            </div>
            <div class="custom-meta">
                <div id="shipCredits" class="ship-credits"></div>
                <div class="custom-tabs">
                    <button class="tab-btn active" data-tab="parts">Parts</button>
                    <button class="tab-btn" data-tab="effects">Effects</button>
                    <button class="tab-btn" data-tab="shop">Shop</button>
                    <button class="tab-btn" data-tab="presets">Presets</button>
                </div>
            </div>
        </div>
        <div class="customization-area">
            <div class="ship-preview">
                <div id="shipPreviewContainer" class="ship-preview-canvas"></div>
                <div class="showroom-controls">
                    <label class="toggle-row">
                        <span>Auto Rotate</span>
                        <input type="checkbox" id="autoRotate" />
                    </label>
                    <label>
                        Rotate Speed
                        <input type="range" id="rotationSpeed" min="0" max="1" step="0.01" />
                    </label>
                    <label>
                        Zoom
                        <input type="range" id="zoomLevel" min="2.5" max="7" step="0.1" />
                    </label>
                </div>
            </div>
            <div class="custom-panels">
                <div class="custom-panel active" data-panel="parts">
                    <div class="option-section">
                        <h3>Ship Type</h3>
                        <div id="shipTypeOptions" class="option-grid option-grid--types"></div>
                    </div>
                    <div class="option-section">
                        <h3>Nose</h3>
                        <div id="noseOptions" class="option-grid option-grid--parts"></div>
                    </div>
                    <div class="option-section">
                        <h3>Tail</h3>
                        <div id="tailOptions" class="option-grid option-grid--parts"></div>
                    </div>
                    <div class="option-section">
                        <h3>Wings</h3>
                        <div id="wingOptions" class="option-grid option-grid--wings"></div>
                    </div>
                    <div class="option-section">
                        <h3>Weapons</h3>
                        <div id="weaponOptions" class="option-grid option-grid--parts"></div>
                    </div>
                </div>
                <div class="custom-panel" data-panel="effects">
                    <div class="option-section">
                        <h3>Colorway</h3>
                        <div id="colorOptions" class="option-grid option-grid--colors"></div>
                    </div>
                    <div class="option-section">
                        <h3>Skins</h3>
                        <div id="skinOptions" class="option-grid option-grid--skins"></div>
                    </div>
                    <div class="option-section">
                        <h3>Finish</h3>
                        <div id="finishOptions" class="option-grid option-grid--parts"></div>
                    </div>
                    <div class="option-section">
                        <h3>Engine Core</h3>
                        <div id="engineOptions" class="option-grid option-grid--engines"></div>
                    </div>
                    <div class="option-section">
                        <h3>Trail</h3>
                        <div id="trailOptions" class="option-grid option-grid--engines"></div>
                    </div>
                    <div class="option-section">
                        <h3>Decal</h3>
                        <div id="decalOptions" class="option-grid option-grid--parts"></div>
                    </div>
                    <div class="option-section">
                        <h3>Lighting</h3>
                        <div id="lightingOptions" class="option-grid option-grid--parts"></div>
                    </div>
                </div>
                <div class="custom-panel" data-panel="shop">
                    <div class="shop-list" id="shopList"></div>
                </div>
                <div class="custom-panel" data-panel="presets">
                    <div class="preset-controls">
                        <input id="presetName" type="text" placeholder="Preset name" />
                        <button id="savePreset" class="btn btn-primary">Save</button>
                    </div>
                    <div class="preset-list" id="presetList"></div>
                    <div class="share-controls">
                        <input id="shareCode" type="text" placeholder="Share code" />
                        <button id="generateShare" class="btn btn-primary">Generate</button>
                        <button id="importShare" class="btn btn-accent">Import</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="custom-actions">
            <button id="saveCustomization" class="btn btn-primary">
                Save & Return
            </button>
            <button id="cancelCustomization" class="btn btn-danger">Cancel</button>
        </div>
    `;

	document.body.appendChild(customizeScreen);

	// Ensure a customize button exists on the start screen
	let customizeButton = document.getElementById("customizeShipButton");
	if (!customizeButton) {
		customizeButton = document.createElement("button");
		customizeButton.id = "customizeShipButton";
		customizeButton.textContent = "Customize Ship";
		customizeButton.className = "btn btn-accent btn-xl";

		const startButton = document.getElementById("startButton");
		if (startButton && startButton.parentNode) {
			startButton.parentNode.insertBefore(
				customizeButton,
				startButton
			);
		}
	}

	// Populate options and add event listeners
	populateCustomizationOptions();
	if (typeof THREE !== "undefined") {
		setupShipPreview();
	}
	loadCustomizationSelection();
	setupCustomizationUI();
}

function setActiveTab(tabName) {
	const tabButtons = document.querySelectorAll(".tab-btn");
	const panels = document.querySelectorAll(".custom-panel");
	tabButtons.forEach((button) => {
		const isActive = button.dataset.tab === tabName;
		button.classList.toggle("active", isActive);
	});
	panels.forEach((panel) => {
		const isActive = panel.dataset.panel === tabName;
		panel.classList.toggle("active", isActive);
	});
}

function setupCustomizationUI() {
	const tabButtons = document.querySelectorAll(".tab-btn");
	tabButtons.forEach((button) => {
		button.onclick = () => setActiveTab(button.dataset.tab);
	});

	const savePresetButton = document.getElementById("savePreset");
	if (savePresetButton) {
		savePresetButton.onclick = saveCurrentPreset;
	}

	const generateShareButton = document.getElementById("generateShare");
	if (generateShareButton) {
		generateShareButton.onclick = generateShareCode;
	}

	const importShareButton = document.getElementById("importShare");
	if (importShareButton) {
		importShareButton.onclick = importShareCode;
	}
}

// Function to apply customizations to the ship
function applyShipCustomization(
	colorIndex,
	wingIndex,
	engineIndex,
	shipTypeIndex,
	noseIndex,
	tailIndex,
	weaponIndex,
	decalIndex,
	finishIndex,
	trailIndex,
	skipSave
) {
	const selectedColor = shipCustomizations.colors[colorIndex];
	const selectedWing = shipCustomizations.wings[wingIndex];
	const selectedEngine = shipCustomizations.engineEffects[engineIndex];
	const selectedShipType = shipCustomizations.shipTypes[shipTypeIndex];
	const selectedNose = shipCustomizations.noses[noseIndex];
	const selectedTail = shipCustomizations.tails[tailIndex];
	const selectedWeapon = shipCustomizations.weapons[weaponIndex];
	const selectedDecal = shipCustomizations.decals[decalIndex];
	const selectedFinish = shipCustomizations.finishes[finishIndex];
	const selectedTrail = shipCustomizations.trails[trailIndex];

	// Apply to ship mesh materials
	ship.material.color.setHex(selectedColor.primary);
	wings.material.color.setHex(selectedColor.secondary);
	shipDetailMaterial.color.setHex(selectedColor.secondary);
	shipDetailMaterial.emissive.setHex(selectedColor.secondary);
	shipMaterial.emissive.setHex(selectedColor.primary);

	// Apply wing style
	wings.scale.x = selectedWing.scale.x;
	wings.scale.y = selectedWing.scale.y;

	// If you want to change geometry types, you might need something like this:
	if (wings.geometry.type !== selectedWing.geometry) {
		// Create new geometry based on selected type
		let newGeometry;
		if (selectedWing.geometry === "BoxGeometry") {
			newGeometry = new THREE.BoxGeometry(2, 0.1, 0.8);
		} else if (selectedWing.geometry === "ConeGeometry") {
			newGeometry = new THREE.ConeGeometry(0.5, 1, 4);
		}

		// Apply the new geometry to the wings
		wings.geometry.dispose(); // Clean up old geometry
		wings.geometry = newGeometry;
	}

	// Apply engine effect
	engineGlowMaterial.color.setHex(selectedEngine.color);
	engineLight.color.setHex(selectedEngine.color);
	engineLight.intensity = selectedEngine.intensity;

	// Apply ship type
	if (selectedShipType) {
		const newGeometry = createShipBodyGeometry(selectedShipType);
		if (newGeometry) {
			ship.geometry.dispose();
			ship.geometry = newGeometry;
			ship.rotation.x = Math.PI / 2;
			ship.scale.set(
				selectedShipType.scale,
				selectedShipType.scale,
				selectedShipType.scale
			);
		}
	}

	if (selectedFinish) {
		shipMaterial.shininess = selectedFinish.shininess;
		shipDetailMaterial.shininess = selectedFinish.shininess;
		shipMaterial.emissiveIntensity =
			selectedFinish.emissiveIntensity;
	}

	if (selectedNose) {
		const noseGeometry = createAttachmentGeometry(
			selectedNose.shape,
			selectedNose.scale
		);
		if (noseGeometry) {
			nose.geometry.dispose();
			nose.geometry = noseGeometry;
			nose.rotation.x = Math.PI / 2;
			nose.position.z =
				selectedShipType && selectedShipType.offsets
					? selectedShipType.offsets.nose
					: selectedNose.offsetZ;
		}
	}

	if (selectedTail) {
		const tailGeometry = createAttachmentGeometry(
			selectedTail.shape,
			selectedTail.scale
		);
		if (tailGeometry) {
			tail.geometry.dispose();
			tail.geometry = tailGeometry;
			tail.rotation.x = Math.PI / 2;
			tail.position.z =
				selectedShipType && selectedShipType.offsets
					? selectedShipType.offsets.tail
					: selectedTail.offsetZ;
		}
	}

	if (selectedWeapon) {
		const weaponGeometry = createAttachmentGeometry(
			selectedWeapon.shape,
			selectedWeapon.scale
		);
		if (weaponGeometry) {
			weaponLeft.geometry.dispose();
			weaponRight.geometry.dispose();
			weaponLeft.geometry = weaponGeometry.clone();
			weaponRight.geometry = weaponGeometry;
			weaponLeft.rotation.z = Math.PI / 2;
			weaponRight.rotation.z = Math.PI / 2;
			weaponLeft.position.set(
				-selectedWeapon.offset.x,
				selectedWeapon.offset.y,
				selectedWeapon.offset.z
			);
			weaponRight.position.set(
				selectedWeapon.offset.x,
				selectedWeapon.offset.y,
				selectedWeapon.offset.z
			);
		}
	}

	if (selectedDecal) {
		decalMaterial.color.setHex(selectedDecal.color);
		decalMaterial.opacity = selectedDecal.opacity;
		decal.visible = selectedDecal.opacity > 0.05;
	}

	if (selectedTrail) {
		applyTrailStyle(selectedTrail);
	}

	// Save preferences to localStorage
	if (!skipSave) {
		saveCustomizationPreferences(
			colorIndex,
			wingIndex,
			engineIndex,
			shipTypeIndex,
			noseIndex,
			tailIndex,
			weaponIndex,
			decalIndex,
			finishIndex,
			trailIndex
		);
	}
}

function createOptionCard({
	category,
	index,
	selectedIndex,
	label,
	meta,
	unlocked,
	swatch,
	onSelect,
	onPurchase,
	badge,
	rarity,
}) {
	const card = document.createElement("div");
	card.className = `option-card ${category}-option`;
	card.dataset.index = index;
	if (index === selectedIndex) {
		card.classList.add("option-card--selected");
	}
	if (!unlocked) {
		card.classList.add("option-card--locked");
	}
	if (rarity) {
		card.classList.add(getRarityClass(rarity));
	}

	const swatchEl = document.createElement("div");
	swatchEl.className = "option-swatch";
	if (swatch) {
		swatchEl.style.cssText = swatch;
	}
	card.appendChild(swatchEl);

	const nameEl = document.createElement("div");
	nameEl.className = "option-name";
	nameEl.textContent = label;
	card.appendChild(nameEl);

	if (meta) {
		const metaEl = document.createElement("div");
		metaEl.className = "option-meta";
		metaEl.textContent = meta;
		card.appendChild(metaEl);
	}

	const lockEl = document.createElement("div");
	lockEl.className = "option-lock";
	lockEl.textContent = unlocked ? "" : "Locked";
	card.appendChild(lockEl);

	if (badge) {
		const badgeEl = document.createElement("div");
		badgeEl.className = "option-badge";
		badgeEl.textContent = badge;
		card.appendChild(badgeEl);
	}

	card.addEventListener("click", () => {
		if (unlocked) {
			onSelect(index);
			return;
		}
		if (onPurchase) {
			onPurchase(index);
		}
	});

	return card;
}

function buildShapePreviewSvg(type, color) {
	const fill = color || "#6fd1ff";
	let shape = "";
	switch (type) {
		case "Cone":
			shape =
				'<polygon points="50,8 92,88 8,88" />';
			break;
		case "Cylinder":
			shape =
				'<rect x="18" y="18" width="64" height="64" rx="18" />';
			break;
		case "Box":
			shape =
				'<rect x="16" y="20" width="68" height="58" rx="10" />';
			break;
		case "Octahedron":
			shape =
				'<polygon points="50,8 88,50 50,92 12,50" />';
			break;
		case "Torus":
			shape =
				'<circle cx="50" cy="50" r="30" fill="none" stroke="' +
				fill +
				'" stroke-width="14" />';
			break;
		case "Chevron":
			shape =
				'<path d="M12 30 L50 70 L88 30 L74 30 L50 55 L26 30 Z" />';
			break;
		case "Stripe":
			shape = '<rect x="12" y="40" width="76" height="20" rx="6" />';
			break;
		default:
			shape = '<rect x="18" y="18" width="64" height="64" rx="12" />';
	}

	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="' +
		fill +
		'">' +
		shape +
		"</svg>";
	return (
		'background-image: url("data:image/svg+xml;utf8,' +
		encodeURIComponent(svg) +
		'"); background-repeat: no-repeat; background-position: center; background-size: 70%;'
	);
}

// Populate the customization options from the configuration
function markCustomSelection() {
	customizationSelection.skinId = "none";
}

function applySkinSelection(skinId) {
	const skin = getSkinById(skinId);
	if (!skin) return;

	if (skin.data) {
		const data = normalizeSelection({
			...customizationSelection,
			...skin.data,
		});

		const unlockCategories = [
			"colors",
			"wings",
			"engineEffects",
			"shipTypes",
			"noses",
			"tails",
			"weapons",
			"decals",
			"finishes",
			"trails",
		];

		unlockCategories.forEach((category) => {
			const key = category.replace("engineEffects", "engineIndex");
			const indexKeyMap = {
				colors: "colorIndex",
				wings: "wingIndex",
				engineEffects: "engineIndex",
				shipTypes: "shipTypeIndex",
				noses: "noseIndex",
				tails: "tailIndex",
				weapons: "weaponIndex",
				decals: "decalIndex",
				finishes: "finishIndex",
				trails: "trailIndex",
			};
			const indexKey = indexKeyMap[category];
			if (indexKey && typeof data[indexKey] === "number") {
				unlockItem(category, data[indexKey]);
			}
		});

		customizationSelection = { ...data, skinId: skin.id };
	} else {
		customizationSelection.skinId = "none";
	}

	applySelectionToUI();
}

function populateCustomizationOptions() {
	const colorOptionsContainer = document.getElementById("colorOptions");
	const wingOptionsContainer = document.getElementById("wingOptions");
	const engineOptionsContainer = document.getElementById("engineOptions");
	const shipTypeOptionsContainer = document.getElementById("shipTypeOptions");
	const skinOptionsContainer = document.getElementById("skinOptions");
	const noseOptionsContainer = document.getElementById("noseOptions");
	const tailOptionsContainer = document.getElementById("tailOptions");
	const weaponOptionsContainer = document.getElementById("weaponOptions");
	const decalOptionsContainer = document.getElementById("decalOptions");
	const finishOptionsContainer = document.getElementById("finishOptions");
	const trailOptionsContainer = document.getElementById("trailOptions");
	const lightingOptionsContainer = document.getElementById("lightingOptions");

	const saved = normalizeSelection(getCustomizationPreferences());
	customizationSelection = { ...saved };

	const containers = [
		colorOptionsContainer,
		wingOptionsContainer,
		engineOptionsContainer,
		shipTypeOptionsContainer,
		skinOptionsContainer,
		noseOptionsContainer,
		tailOptionsContainer,
		weaponOptionsContainer,
		decalOptionsContainer,
		finishOptionsContainer,
		trailOptionsContainer,
		lightingOptionsContainer,
	];
	containers.forEach((container) => {
		if (container) container.innerHTML = "";
	});

	shipCustomizations.colors.forEach((color, index) => {
		const unlocked = isUnlocked("colors", index);
		const swatch = `background: linear-gradient(135deg, #${color.primary
			.toString(16)
			.padStart(6, "0")}, #${color.secondary
			.toString(16)
			.padStart(6, "0")});`;
		const cost = color.cost || 0;
		const card = createOptionCard({
			category: "color",
			index,
			selectedIndex: customizationSelection.colorIndex,
			label: color.name,
			meta: unlocked ? "Owned" : `Cost ${cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.colorIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("colors", index, cost)) {
					showNotification(`${color.name} unlocked!`);
					markCustomSelection();
					customizationSelection.colorIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (colorOptionsContainer) colorOptionsContainer.appendChild(card);
	});

	shipCustomizations.wings.forEach((wing, index) => {
		const unlocked = isUnlocked("wings", index);
		const shapePreview = wing.geometry === "ConeGeometry" ? "Cone" : "Box";
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg(shapePreview, "#92a9ff");
		const cost = wing.cost || 0;
		const card = createOptionCard({
			category: "wing",
			index,
			selectedIndex: customizationSelection.wingIndex,
			label: wing.name,
			meta: unlocked ? "Owned" : `Cost ${cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.wingIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("wings", index, cost)) {
					showNotification(`${wing.name} unlocked!`);
					markCustomSelection();
					customizationSelection.wingIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (wingOptionsContainer) wingOptionsContainer.appendChild(card);
	});

	shipCustomizations.engineEffects.forEach((engine, index) => {
		const unlocked = isUnlocked("engineEffects", index);
		const swatch = `background: radial-gradient(circle, #${engine.color
			.toString(16)
			.padStart(6, "0")}, #0a141f);`;
		const cost = engine.cost || 0;
		const card = createOptionCard({
			category: "engine",
			index,
			selectedIndex: customizationSelection.engineIndex,
			label: engine.name,
			meta: unlocked ? "Owned" : `Cost ${cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.engineIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("engineEffects", index, cost)) {
					showNotification(`${engine.name} unlocked!`);
					markCustomSelection();
					customizationSelection.engineIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (engineOptionsContainer) engineOptionsContainer.appendChild(card);
	});

	shipCustomizations.shipTypes.forEach((shipType, index) => {
		const unlocked = isUnlocked("shipTypes", index);
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg(shipType.shape, "#6fd1ff");
		const card = createOptionCard({
			category: "shiptype",
			index,
			selectedIndex: customizationSelection.shipTypeIndex,
			label: shipType.name,
			meta: unlocked ? "Owned" : `Cost ${shipType.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.shipTypeIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("shipTypes", index, shipType.cost)) {
					showNotification(`${shipType.name} unlocked!`);
					markCustomSelection();
					customizationSelection.shipTypeIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (shipTypeOptionsContainer)
			shipTypeOptionsContainer.appendChild(card);
	});

	shipCustomizations.noses.forEach((noseItem, index) => {
		const unlocked = isUnlocked("noses", index);
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg(noseItem.shape, "#6fd1ff");
		const card = createOptionCard({
			category: "nose",
			index,
			selectedIndex: customizationSelection.noseIndex,
			label: noseItem.name,
			meta: unlocked ? "Owned" : `Cost ${noseItem.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.noseIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("noses", index, noseItem.cost)) {
					showNotification(`${noseItem.name} unlocked!`);
					markCustomSelection();
					customizationSelection.noseIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (noseOptionsContainer) noseOptionsContainer.appendChild(card);
	});

	shipCustomizations.tails.forEach((tailItem, index) => {
		const unlocked = isUnlocked("tails", index);
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg(tailItem.shape, "#6fd1ff");
		const card = createOptionCard({
			category: "tail",
			index,
			selectedIndex: customizationSelection.tailIndex,
			label: tailItem.name,
			meta: unlocked ? "Owned" : `Cost ${tailItem.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.tailIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("tails", index, tailItem.cost)) {
					showNotification(`${tailItem.name} unlocked!`);
					markCustomSelection();
					customizationSelection.tailIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (tailOptionsContainer) tailOptionsContainer.appendChild(card);
	});

	shipCustomizations.weapons.forEach((weaponItem, index) => {
		const unlocked = isUnlocked("weapons", index);
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg(weaponItem.shape, "#ffb03b");
		const card = createOptionCard({
			category: "weapon",
			index,
			selectedIndex: customizationSelection.weaponIndex,
			label: weaponItem.name,
			meta: unlocked ? "Owned" : `Cost ${weaponItem.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.weaponIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("weapons", index, weaponItem.cost)) {
					showNotification(`${weaponItem.name} unlocked!`);
					markCustomSelection();
					customizationSelection.weaponIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (weaponOptionsContainer) weaponOptionsContainer.appendChild(card);
	});

	shipCustomizations.decals.forEach((decalItem, index) => {
		const unlocked = isUnlocked("decals", index);
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg(decalItem.style, "#9bdcff");
		const card = createOptionCard({
			category: "decal",
			index,
			selectedIndex: customizationSelection.decalIndex,
			label: decalItem.name,
			meta: unlocked ? "Owned" : `Cost ${decalItem.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.decalIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("decals", index, decalItem.cost)) {
					showNotification(`${decalItem.name} unlocked!`);
					markCustomSelection();
					customizationSelection.decalIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (decalOptionsContainer) decalOptionsContainer.appendChild(card);
	});

	shipCustomizations.finishes.forEach((finishItem, index) => {
		const unlocked = isUnlocked("finishes", index);
		const swatch =
			"background: linear-gradient(135deg, #1c2a38, #2b3e52); " +
			buildShapePreviewSvg("Box", "#9ad3ff");
		const card = createOptionCard({
			category: "finish",
			index,
			selectedIndex: customizationSelection.finishIndex,
			label: finishItem.name,
			meta: unlocked ? "Owned" : `Cost ${finishItem.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.finishIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("finishes", index, finishItem.cost)) {
					showNotification(`${finishItem.name} unlocked!`);
					markCustomSelection();
					customizationSelection.finishIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (finishOptionsContainer) finishOptionsContainer.appendChild(card);
	});

	shipCustomizations.trails.forEach((trailItem, index) => {
		const unlocked = isUnlocked("trails", index);
		const swatch = `background: radial-gradient(circle, #${trailItem.color
			.toString(16)
			.padStart(6, "0")}, #0a141f);`;
		const card = createOptionCard({
			category: "trail",
			index,
			selectedIndex: customizationSelection.trailIndex,
			label: trailItem.name,
			meta: unlocked ? "Owned" : `Cost ${trailItem.cost}`,
			unlocked,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.trailIndex = idx;
				applySelectionToUI();
			},
			onPurchase: () => {
				if (purchaseItem("trails", index, trailItem.cost)) {
					showNotification(`${trailItem.name} unlocked!`);
					markCustomSelection();
					customizationSelection.trailIndex = index;
					populateCustomizationOptions();
					applySelectionToUI();
				}
			},
		});
		if (trailOptionsContainer) trailOptionsContainer.appendChild(card);
	});

	shipCustomizations.lightingPresets.forEach((preset, index) => {
		const swatch =
			"background: #1c2a38; " +
			buildShapePreviewSvg("Box", "#8cc8ff");
		const card = createOptionCard({
			category: "lighting",
			index,
			selectedIndex: customizationSelection.lightingIndex,
			label: preset.name,
			meta: "Preview",
			unlocked: true,
			swatch,
			onSelect: (idx) => {
				markCustomSelection();
				customizationSelection.lightingIndex = idx;
				applySelectionToUI();
			},
		});
		if (lightingOptionsContainer) lightingOptionsContainer.appendChild(card);
	});

	if (skinOptionsContainer) {
		skinCatalog.forEach((skin) => {
			const owned = isSkinOwned(skin.id);
			const swatch =
				"background: #1c2a38; " +
				buildShapePreviewSvg("Box", "#6fd1ff");
			const card = createOptionCard({
				category: "skin",
				index: skin.id,
				selectedIndex: customizationSelection.skinId,
				label: skin.name,
				meta: owned ? "Owned" : skin.rarity,
				unlocked: owned,
				swatch,
				badge: skin.rarity,
				rarity: skin.rarity,
				onSelect: (id) => {
					applySkinSelection(id);
				},
				onPurchase: () => {
					showNotification("Unlock skins via gacha or packs.");
				},
			});
			skinOptionsContainer.appendChild(card);
		});
	}

	updateCreditsUI();
	renderPresetList();
	populateShopPanel();

	const saveButton = document.getElementById("saveCustomization");
	if (saveButton) {
		saveButton.onclick = () => {
			applyShipCustomization(
				customizationSelection.colorIndex,
				customizationSelection.wingIndex,
				customizationSelection.engineIndex,
				customizationSelection.shipTypeIndex,
				customizationSelection.noseIndex,
				customizationSelection.tailIndex,
				customizationSelection.weaponIndex,
				customizationSelection.decalIndex,
				customizationSelection.finishIndex,
				customizationSelection.trailIndex
			);
			document.getElementById("customizeScreen").style.display = "none";
		};
	}

	const cancelButton = document.getElementById("cancelCustomization");
	if (cancelButton) {
		cancelButton.onclick = () => {
			document.getElementById("customizeScreen").style.display = "none";
			loadCustomizationSelection();
		};
	}

	const rotationInput = document.getElementById("rotationSpeed");
	if (rotationInput) {
		rotationInput.value = customizationSelection.rotateSpeed;
		rotationInput.oninput = (event) => {
			customizationSelection.rotateSpeed = Number(event.target.value);
			applyShowroomSettings();
		};
	}

	const zoomInput = document.getElementById("zoomLevel");
	if (zoomInput) {
		zoomInput.value = customizationSelection.zoomLevel;
		zoomInput.oninput = (event) => {
			customizationSelection.zoomLevel = Number(event.target.value);
			applyShowroomSettings();
		};
	}

	const autoRotateInput = document.getElementById("autoRotate");
	if (autoRotateInput) {
		autoRotateInput.checked = customizationSelection.autoRotate;
		autoRotateInput.onchange = (event) => {
			customizationSelection.autoRotate = event.target.checked;
			applyShowroomSettings();
		};
	}
}

function loadPresets() {
	try {
		return JSON.parse(localStorage.getItem("shipPresets")) || [];
	} catch (e) {
		return [];
	}
}

function savePresets(presets) {
	localStorage.setItem("shipPresets", JSON.stringify(presets));
}

function getSelectionSnapshot() {
	return normalizeSelection({ ...customizationSelection });
}

function renderPresetList() {
	const list = document.getElementById("presetList");
	if (!list) return;
	list.innerHTML = "";

	const presets = loadPresets();
	const limit = getPresetLimit();
	const meta = document.createElement("div");
	meta.className = "preset-meta";
	meta.textContent = `Presets: ${presets.length}/${limit}`;
	list.appendChild(meta);
	if (!presets.length) {
		const empty = document.createElement("div");
		empty.className = "preset-empty";
		empty.textContent = "No presets saved yet.";
		list.appendChild(empty);
		return;
	}

	presets.forEach((preset, index) => {
		const card = document.createElement("div");
		card.className = "preset-card";

		const name = document.createElement("div");
		name.className = "preset-name";
		name.textContent = preset.name;
		card.appendChild(name);

		const buttons = document.createElement("div");
		buttons.className = "preset-actions";

		const applyButton = document.createElement("button");
		applyButton.className = "btn btn-primary";
		applyButton.textContent = "Load";
		applyButton.onclick = () => {
			const normalized = normalizeSelection(preset.data);
			customizationSelection = { ...normalized };
			applySelectionToUI();
		};

		const deleteButton = document.createElement("button");
		deleteButton.className = "btn btn-danger";
		deleteButton.textContent = "Delete";
		deleteButton.onclick = () => {
			const updated = presets.filter((_, i) => i !== index);
			savePresets(updated);
			renderPresetList();
		};

		buttons.appendChild(applyButton);
		buttons.appendChild(deleteButton);
		card.appendChild(buttons);

		list.appendChild(card);
	});
}

function saveCurrentPreset() {
	const input = document.getElementById("presetName");
	const name = input ? input.value.trim() : "";
	if (!name) {
		showNotification("Enter a preset name.");
		return;
	}

	const presets = loadPresets();
	presets.unshift({
		name,
		data: getSelectionSnapshot(),
		createdAt: Date.now(),
	});
	const limit = Math.max(1, getPresetLimit());
	savePresets(presets.slice(0, limit));
	if (input) input.value = "";
	renderPresetList();
	showNotification("Preset saved.");
}

function generateShareCode() {
	const input = document.getElementById("shareCode");
	if (!input) return;
	const payload = getSelectionSnapshot();
	const code = btoa(JSON.stringify(payload));
	input.value = code;
	showNotification("Share code generated.");
}

function importShareCode() {
	const input = document.getElementById("shareCode");
	if (!input) return;
	const code = input.value.trim();
	if (!code) {
		showNotification("Paste a share code.");
		return;
	}

	try {
		const decoded = JSON.parse(atob(code));
		const normalized = normalizeSelection(decoded);
		customizationSelection = { ...normalized };
		applySelectionToUI();
		showNotification("Share code applied.");
	} catch (e) {
		showNotification("Invalid share code.");
	}
}

function populateShopPanel() {
	const shopList = document.getElementById("shopList");
	if (!shopList) return;
	shopList.innerHTML = "";

	const activeTheme = getActiveTheme();
	const themedPool = getThemedPool(activeTheme);
	const themeLabel =
		activeTheme && themedPool.length >= 3
			? activeTheme.name
			: "Classic Pool";
	if (!gachaState) {
		gachaState = loadGachaState();
	}
	const epicPityLeft = Math.max(0, gachaPity.epic - gachaState.sinceEpic);
	const mythicPityLeft = Math.max(
		0,
		gachaPity.mythic - gachaState.sinceMythic
	);

	const gachaSection = document.createElement("div");
	gachaSection.className = "shop-section";
	gachaSection.innerHTML = `
		<div class="shop-section-title">Gacha Core</div>
		<div class="shop-gacha">
			<div class="shop-gacha-meta">
				<div class="shop-gacha-title">Random Skin Roll</div>
				<div class="shop-gacha-odds">Common 60% · Rare 25% · Epic 12% · Mythic 3%</div>
				<div class="shop-gacha-odds">Theme: ${themeLabel}</div>
				<div class="shop-gacha-odds">Pity: Epic in ${epicPityLeft} · Mythic in ${mythicPityLeft}</div>
			</div>
			<button id="gachaRoll" class="btn btn-accent">Roll 500</button>
		</div>
		<div class="shop-pack-list" id="packList"></div>
	`;
	shopList.appendChild(gachaSection);

	const gachaButton = gachaSection.querySelector("#gachaRoll");
	if (gachaButton) {
		gachaButton.onclick = () => {
			const results = runGachaRoll(500, "Common", null, {
				rolls: 1,
				theme: activeTheme,
				label: "Gacha Core",
			});
			if (results && results.length) {
				showGachaResults(
					results,
					[],
					activeTheme && themedPool.length >= 3
						? `Gacha Core · ${activeTheme.name}`
						: "Gacha Core"
				);
			}
		};
	}

	const packList = gachaSection.querySelector("#packList");
	skinPacks.forEach((pack) => {
		const bonusMeta = [];
		if (pack.bonusRewards) {
			if (pack.bonusRewards.creditsMin) {
				bonusMeta.push(
					`Credits ${pack.bonusRewards.creditsMin}-${pack.bonusRewards.creditsMax}`
				);
			}
			if (pack.bonusRewards.unlockChance) {
				bonusMeta.push(
					`Unlock ${Math.round(
						pack.bonusRewards.unlockChance * 100
					)}%`
				);
			}
			if (pack.bonusRewards.presetSlotChance) {
				bonusMeta.push(
					`Preset +${Math.round(
						pack.bonusRewards.presetSlotChance * 100
					)}%`
				);
			}
		}

		const packCard = document.createElement("div");
		packCard.className = "shop-pack";
		packCard.innerHTML = `
			<div>
				<div class="shop-pack-name">${pack.name}</div>
				<div class="shop-pack-meta">Min ${pack.minRarity} · Rolls ${pack.rolls} · Cost ${pack.cost}</div>
				<div class="shop-pack-meta">Theme: ${themeLabel}</div>
				${bonusMeta.length ? `<div class="shop-pack-meta">Bonus: ${bonusMeta.join(" · ")}</div>` : ""}
			</div>
			<button class="btn btn-primary">Open</button>
		`;
		const button = packCard.querySelector("button");
		button.onclick = () => {
			const results = runGachaRoll(pack.cost, pack.minRarity, pack.bonus, {
				rolls: pack.rolls,
				theme: activeTheme,
				label: pack.name,
			});
			if (results && results.length) {
				const rewards = awardPackRewards(pack);
				showGachaResults(
					results,
					rewards,
					activeTheme && themedPool.length >= 3
						? `${pack.name} · ${activeTheme.name}`
						: pack.name
				);
			}
		};
		packList.appendChild(packCard);
	});

	const catalog = [
		{ key: "colors", items: shipCustomizations.colors },
		{ key: "wings", items: shipCustomizations.wings },
		{ key: "shipTypes", items: shipCustomizations.shipTypes },
		{ key: "noses", items: shipCustomizations.noses },
		{ key: "tails", items: shipCustomizations.tails },
		{ key: "weapons", items: shipCustomizations.weapons },
		{ key: "decals", items: shipCustomizations.decals },
		{ key: "finishes", items: shipCustomizations.finishes },
		{ key: "trails", items: shipCustomizations.trails },
		{ key: "engineEffects", items: shipCustomizations.engineEffects },
	];

	const lockedItems = [];
	catalog.forEach((group) => {
		group.items.forEach((item, index) => {
			if (!item.cost || item.cost <= 0) return;
			if (isUnlocked(group.key, index)) return;
			lockedItems.push({
				category: group.key,
				index,
				name: item.name,
				cost: item.cost,
			});
		});
	});

	if (!lockedItems.length) {
		const empty = document.createElement("div");
		empty.className = "shop-empty";
		empty.textContent = "All items unlocked. You are elite.";
		shopList.appendChild(empty);
		return;
	}

	lockedItems.forEach((item) => {
		const card = document.createElement("div");
		card.className = "shop-card";

		const title = document.createElement("div");
		title.className = "shop-name";
		title.textContent = item.name;
		card.appendChild(title);

		const meta = document.createElement("div");
		meta.className = "shop-meta";
		meta.textContent = `${item.category} · Cost ${item.cost}`;
		card.appendChild(meta);

		const buyButton = document.createElement("button");
		buyButton.className = "btn btn-accent";
		buyButton.textContent = "Unlock";
		buyButton.onclick = () => {
			if (purchaseItem(item.category, item.index, item.cost)) {
				showNotification(`${item.name} unlocked!`);
				populateCustomizationOptions();
			}
		};
		card.appendChild(buyButton);

		shopList.appendChild(card);
	});
}

function rollRarity(table) {
	const total = table.reduce((sum, entry) => sum + entry.weight, 0);
	let roll = Math.random() * total;
	for (const entry of table) {
		roll -= entry.weight;
		if (roll <= 0) return entry.rarity;
	}
	return table[0].rarity;
}

function getThemedPool(theme) {
	if (!theme || !theme.tags || !theme.tags.length) return [];
	return skinCatalog
		.filter((skin) => skin.id !== "none")
		.filter(
			(skin) =>
				Array.isArray(skin.tags) &&
				skin.tags.some((tag) => theme.tags.includes(tag))
		);
}

function getSkinPool(theme) {
	let pool = skinCatalog.filter((skin) => skin.id !== "none");
	if (theme && theme.tags && theme.tags.length) {
		const themed = getThemedPool(theme);
		if (themed.length >= 3) {
			pool = themed;
		}
	}
	return pool;
}

function resolveMinRarity(minRarity, pool) {
	const orderList = ["Common", "Rare", "Epic", "Mythic"];
	const minOrder = getRarityOrder(minRarity || "Common");
	const availableOrders = pool.map((skin) =>
		getRarityOrder(skin.rarity)
	);
	const highestAvailable = Math.max(...availableOrders, 0);
	for (let order = minOrder; order <= highestAvailable; order += 1) {
		if (availableOrders.includes(order)) {
			return orderList[order];
		}
	}
	return orderList[highestAvailable] || "Common";
}

function buildGachaTable(minRarity, bonus, pool) {
	const base = gachaTable.map((entry) => ({ ...entry }));
	if (bonus) {
		base.forEach((entry) => {
			if (bonus[entry.rarity]) {
				entry.weight += bonus[entry.rarity];
			}
		});
	}

	const resolvedMin = resolveMinRarity(minRarity, pool);
	const minOrder = getRarityOrder(resolvedMin || "Common");
	let table = base.filter(
		(entry) => getRarityOrder(entry.rarity) >= minOrder
	);

	if (pool && pool.length) {
		const available = new Set(pool.map((skin) => skin.rarity));
		table = table.filter((entry) => available.has(entry.rarity));
		if (!table.length) {
			table = base.filter((entry) => available.has(entry.rarity));
		}
	}

	return table;
}

function rollSkinByRarity(rarity, pool) {
	const poolByRarity = pool.filter((skin) => skin.rarity === rarity);
	if (!poolByRarity.length) {
		return null;
	}
	return poolByRarity[Math.floor(Math.random() * poolByRarity.length)];
}

function updateGachaState(rarity) {
	gachaState.totalRolls += 1;

	if (rarity === "Mythic") {
		gachaState.sinceMythic = 0;
		gachaState.sinceEpic = 0;
	} else if (rarity === "Epic") {
		gachaState.sinceEpic = 0;
		gachaState.sinceMythic += 1;
	} else {
		gachaState.sinceEpic += 1;
		gachaState.sinceMythic += 1;
	}

	saveGachaState(gachaState);
}

function rollRarityWithPity(minRarity, bonus, pool) {
	if (!gachaState) {
		gachaState = loadGachaState();
	}
	const resolvedMin = resolveMinRarity(minRarity, pool);
	const minOrder = getRarityOrder(resolvedMin);
	const available = new Set(pool.map((skin) => skin.rarity));
	const canGuaranteeEpic =
		available.has("Epic") && getRarityOrder("Epic") >= minOrder;
	const canGuaranteeMythic =
		available.has("Mythic") &&
		getRarityOrder("Mythic") >= minOrder;

	let pityUsed = null;
	let rarity = null;

	if (
		canGuaranteeMythic &&
		gachaState.sinceMythic >= gachaPity.mythic
	) {
		rarity = "Mythic";
		pityUsed = "Mythic";
	} else if (
		canGuaranteeEpic &&
		gachaState.sinceEpic >= gachaPity.epic
	) {
		rarity = "Epic";
		pityUsed = "Epic";
	} else {
		const table = buildGachaTable(resolvedMin, bonus, pool);
		rarity = rollRarity(table);
	}

	updateGachaState(rarity);
	return { rarity, pityUsed };
}

function unlockRandomCosmetic() {
	const categories = ["decals", "trails", "finishes"];
	const lockedItems = [];
	categories.forEach((category) => {
		const items = shipCustomizations[category] || [];
		items.forEach((item, index) => {
			if (item.cost && !isUnlocked(category, index)) {
				lockedItems.push({ category, item, index });
			}
		});
	});

	if (!lockedItems.length) return null;
	const picked =
		lockedItems[Math.floor(Math.random() * lockedItems.length)];
	unlockItem(picked.category, picked.index);
	return { category: picked.category, name: picked.item.name };
}

function awardPackRewards(pack) {
	const rewards = [];
	if (!pack || !pack.bonusRewards) return rewards;

	const {
		creditsMin,
		creditsMax,
		unlockChance,
		presetSlotChance,
	} = pack.bonusRewards;

	if (creditsMin && creditsMax) {
		const amount =
			Math.floor(
				Math.random() * (creditsMax - creditsMin + 1)
			) + creditsMin;
		addCredits(amount);
		rewards.push(`+${amount} credits`);
	}

	if (unlockChance && Math.random() < unlockChance) {
		const unlocked = unlockRandomCosmetic();
		if (unlocked) {
			rewards.push(`${unlocked.name} unlocked`);
			populateCustomizationOptions();
		} else {
			addCredits(120);
			rewards.push("+120 credits");
		}
	}

	if (presetSlotChance && Math.random() < presetSlotChance) {
		const current = getPresetLimit();
		const nextLimit = Math.min(current + 1, 20);
		if (nextLimit > current) {
			setPresetLimit(nextLimit);
			rewards.push("+1 preset slot");
		} else {
			addCredits(150);
			rewards.push("+150 credits");
		}
	}

	return rewards;
}

function showGachaResults(results, bonusRewards, contextLabel) {
	const modal = document.getElementById("gachaResults");
	if (!modal) return;

	const title = modal.querySelector(".gacha-results-title");
	const list = modal.querySelector(".gacha-results-list");
	const bonus = modal.querySelector(".gacha-results-bonus");

	if (title) {
		title.textContent = contextLabel || "Results";
	}
	if (list) {
		list.innerHTML = results
			.map((result) => {
				const tags = [];
				if (result.pityUsed) {
					tags.push(`${result.pityUsed} pity`);
				}
				if (result.duplicate) {
					tags.push("duplicate");
				}
				const tagLabel = tags.length ? ` (${tags.join(", ")})` : "";
				return `<li>${result.rarity} · ${result.name}${tagLabel}</li>`;
			})
			.join("");
	}
	if (bonus) {
		bonus.textContent =
			bonusRewards && bonusRewards.length
				? `Bonus: ${bonusRewards.join(" · ")}`
				: "Bonus: none";
	}

	modal.style.display = "block";
	const closeButton = modal.querySelector(".gacha-results-close");
	if (closeButton) {
		closeButton.onclick = () => {
			modal.style.display = "none";
			populateShopPanel();
		};
	}
}

function runGachaRoll(cost, minRarity, bonus, options = {}) {
	if (!purchaseItem("gacha", 0, cost)) {
		return;
	}

	const { rolls = 1, theme = null, label = "Gacha Core" } = options;
	const pool = getSkinPool(theme);
	const rollCost = Math.max(1, Math.floor(cost / rolls));

	const results = [];
	let creditsRefund = 0;
	let lastUnlocked = null;

	for (let i = 0; i < rolls; i++) {
		const { rarity, pityUsed } = rollRarityWithPity(
			minRarity,
			bonus,
			pool
		);
		const skin = rollSkinByRarity(rarity, pool);

		if (!skin) {
			creditsRefund += Math.floor(rollCost * 0.5);
			continue;
		}

		if (isSkinOwned(skin.id)) {
			creditsRefund += Math.floor(rollCost * 0.6);
			results.push({
				id: skin.id,
				name: skin.name,
				rarity: skin.rarity,
				duplicate: true,
				pityUsed,
			});
			continue;
		}

		unlockSkin(skin.id);
		lastUnlocked = skin.id;
		results.push({
			id: skin.id,
			name: skin.name,
			rarity: skin.rarity,
			duplicate: false,
			pityUsed,
		});
	}

	if (creditsRefund > 0) {
		addCredits(creditsRefund);
	}

	if (lastUnlocked) {
		customizationSelection.skinId = lastUnlocked;
		applySkinSelection(lastUnlocked);
		populateCustomizationOptions();
	}

	if (!results.length) {
		showNotification("No skins available in this pool.");
	}

	return results;
}

// Set up Three.js preview of the ship
function setupShipPreview() {
	const container = document.getElementById("shipPreviewContainer");
	if (!container) return;

	// Create scene, camera, renderer
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer({ antialias: true });

	renderer.setSize(container.clientWidth, container.clientHeight);
	container.appendChild(renderer.domElement);

	// Add lights
	const ambientLight = new THREE.AmbientLight(0x333333);
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(5, 5, 5);
	scene.add(directionalLight);

	const rimLight = new THREE.PointLight(0x66ccff, 0.8, 10);
	rimLight.position.set(-4, 2, 3);
	scene.add(rimLight);

	const saved = getCustomizationPreferences();
	const initialShipType =
		shipCustomizations.shipTypes[saved.shipTypeIndex];
	const initialBodyGeometry =
		createShipBodyGeometry(initialShipType) ||
		new THREE.ConeGeometry(0.5, 2, 8);

	const previewDetailMaterial = new THREE.MeshPhongMaterial({
		color: 0x2277cc,
		emissive: 0x001133,
		shininess: 80,
	});
	const previewDecalMaterial = new THREE.MeshBasicMaterial({
		color: 0x66ccff,
		transparent: true,
		opacity: 0.7,
	});

	// Create ship preview meshes
	const previewShip = {
		body: new THREE.Mesh(
			initialBodyGeometry,
			new THREE.MeshPhongMaterial({ color: 0x3399ff })
		),
		wings: new THREE.Mesh(
			new THREE.BoxGeometry(2, 0.1, 0.8),
			previewDetailMaterial
		),
		engine: new THREE.Mesh(
			new THREE.SphereGeometry(0.2, 16, 16),
			new THREE.MeshBasicMaterial({
				color: 0x00ffff,
				transparent: true,
				opacity: 0.8,
			})
		),
		nose: new THREE.Mesh(
			new THREE.ConeGeometry(0.3, 0.8, 8),
			previewDetailMaterial
		),
		tail: new THREE.Mesh(
			new THREE.ConeGeometry(0.35, 0.7, 8),
			previewDetailMaterial
		),
		weaponLeft: new THREE.Mesh(
			new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8),
			previewDetailMaterial
		),
		weaponRight: new THREE.Mesh(
			new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8),
			previewDetailMaterial
		),
		decal: new THREE.Mesh(
			new THREE.PlaneGeometry(0.8, 0.3),
			previewDecalMaterial
		),
	};

	// Position elements
	previewShip.body.rotation.x = Math.PI / 2;
	previewShip.wings.position.y = -0.1;
	previewShip.engine.position.z = -1;
	previewShip.nose.position.z = 1.2;
	previewShip.nose.rotation.x = Math.PI / 2;
	previewShip.tail.position.z = -1.1;
	previewShip.tail.rotation.x = Math.PI / 2;
	previewShip.weaponLeft.rotation.z = Math.PI / 2;
	previewShip.weaponRight.rotation.z = Math.PI / 2;
	previewShip.weaponLeft.position.set(-0.8, -0.1, 0.35);
	previewShip.weaponRight.position.set(0.8, -0.1, 0.35);
	previewShip.decal.position.set(0, 0.25, 0.2);
	previewShip.decal.rotation.x = -Math.PI / 2;

	// Create ship group
	const shipGroup = new THREE.Group();
	shipGroup.add(previewShip.body);
	shipGroup.add(previewShip.wings);
	shipGroup.add(previewShip.engine);
	shipGroup.add(previewShip.nose);
	shipGroup.add(previewShip.tail);
	shipGroup.add(previewShip.weaponLeft);
	shipGroup.add(previewShip.weaponRight);
	shipGroup.add(previewShip.decal);

	scene.add(shipGroup);

	// Position camera
	camera.position.set(0, 1, 4);
	camera.lookAt(0, 0, 0);

	// Add animation
	function animate() {
		requestAnimationFrame(animate);

		const controls = window.previewControls || {};
		if (controls.autoRotate) {
			shipGroup.rotation.y += controls.rotateSpeed || 0.01;
		}

		renderer.render(scene, camera);
	}

	animate();

	// Store references for later updates
	window.previewElements = {
		ship: previewShip,
		scene: scene,
		renderer: renderer,
		container: container,
		camera: camera,
		shipGroup: shipGroup,
		lights: {
			ambient: ambientLight,
			key: directionalLight,
			rim: rimLight,
		},
		materials: {
			detail: previewDetailMaterial,
			decal: previewDecalMaterial,
		},
	};

	initPreviewControls();
}

function refreshShipPreviewSize() {
	if (!window.previewElements || !window.previewElements.container) return;
	const { container, renderer } = window.previewElements;
	const width = container.clientWidth;
	const height = container.clientHeight;
	if (width > 0 && height > 0) {
		renderer.setSize(width, height);
	}
}

function initPreviewControls() {
	if (!window.previewElements) return;
	const { renderer, shipGroup, camera } = window.previewElements;
	if (!renderer || !shipGroup || !camera) return;

	if (!window.previewControls) {
		window.previewControls = {
			autoRotate: true,
			rotateSpeed: 0.012,
			zoom: 4.2,
			isDragging: false,
			lastX: 0,
			lastY: 0,
		};
	}

	const controls = window.previewControls;

	renderer.domElement.addEventListener("mousedown", (event) => {
		controls.isDragging = true;
		controls.lastX = event.clientX;
		controls.lastY = event.clientY;
	});

	window.addEventListener("mouseup", () => {
		controls.isDragging = false;
	});

	window.addEventListener("mousemove", (event) => {
		if (!controls.isDragging) return;
		const deltaX = event.clientX - controls.lastX;
		const deltaY = event.clientY - controls.lastY;
		controls.lastX = event.clientX;
		controls.lastY = event.clientY;
		shipGroup.rotation.y += deltaX * 0.005;
		shipGroup.rotation.x += deltaY * 0.005;
	});

	renderer.domElement.addEventListener("wheel", (event) => {
		event.preventDefault();
		controls.zoom = Math.max(
			2.5,
			Math.min(7, controls.zoom + event.deltaY * 0.002)
		);
		updatePreviewCamera();
	});
}

function updatePreviewCamera() {
	if (!window.previewElements || !window.previewControls) return;
	const { camera } = window.previewElements;
	const { zoom } = window.previewControls;
	camera.position.set(0, 1, zoom);
	camera.lookAt(0, 0, 0);
}

function updatePreviewLighting(index) {
	if (!window.previewElements || !window.previewElements.lights) return;
	const preset = shipCustomizations.lightingPresets[index] ||
		shipCustomizations.lightingPresets[0];
	const { ambient, key, rim } = window.previewElements.lights;
	ambient.color.setHex(preset.ambient);
	key.color.setHex(preset.key);
	key.intensity = preset.intensity;
	rim.intensity = preset.intensity * 0.6;
}

function applyShowroomSettings() {
	if (!window.previewElements) return;
	if (!window.previewControls) {
		initPreviewControls();
	}
	const controls = window.previewControls;
	controls.autoRotate = customizationSelection.autoRotate;
	controls.rotateSpeed = 0.005 + customizationSelection.rotateSpeed * 0.02;
	controls.zoom = customizationSelection.zoomLevel;
	updatePreviewCamera();
	updatePreviewLighting(customizationSelection.lightingIndex);
}

// Update the ship preview with selected options
function updateShipPreview(
	colorIndex,
	wingIndex,
	engineIndex,
	shipTypeIndex,
	noseIndex,
	tailIndex,
	weaponIndex,
	decalIndex,
	finishIndex,
	trailIndex,
	lightingIndex
) {
	if (!window.previewElements) return;

	const selectedColor = shipCustomizations.colors[colorIndex];
	const selectedWing = shipCustomizations.wings[wingIndex];
	const selectedEngine = shipCustomizations.engineEffects[engineIndex];
	const selectedShipType = shipCustomizations.shipTypes[shipTypeIndex];
	const selectedNose = shipCustomizations.noses[noseIndex];
	const selectedTail = shipCustomizations.tails[tailIndex];
	const selectedWeapon = shipCustomizations.weapons[weaponIndex];
	const selectedDecal = shipCustomizations.decals[decalIndex];
	const selectedFinish = shipCustomizations.finishes[finishIndex];
	const selectedTrail = shipCustomizations.trails[trailIndex];

	const preview = window.previewElements.ship;
	const previewMaterials = window.previewElements.materials;

	// Update colors
	preview.body.material.color.setHex(selectedColor.primary);
	preview.wings.material.color.setHex(selectedColor.secondary);
	if (previewMaterials) {
		previewMaterials.detail.color.setHex(selectedColor.secondary);
		previewMaterials.detail.emissive.setHex(selectedColor.secondary);
	}

	// Update wing shape
	if (preview.wings.geometry.type !== selectedWing.geometry) {
		let newGeometry = null;
		if (selectedWing.geometry === "BoxGeometry") {
			newGeometry = new THREE.BoxGeometry(2, 0.1, 0.8);
		} else if (selectedWing.geometry === "ConeGeometry") {
			newGeometry = new THREE.ConeGeometry(0.6, 1, 4);
		}
		if (newGeometry) {
			preview.wings.geometry.dispose();
			preview.wings.geometry = newGeometry;
		}
	}
	preview.wings.scale.x = selectedWing.scale.x;
	preview.wings.scale.y = selectedWing.scale.y;

	// Update ship body type
	if (selectedShipType) {
		const newGeometry = createShipBodyGeometry(selectedShipType);
		if (newGeometry) {
			if (preview.body.geometry.type !== newGeometry.type) {
				preview.body.geometry.dispose();
				preview.body.geometry = newGeometry;
				preview.body.rotation.x = Math.PI / 2;
			} else {
				newGeometry.dispose();
			}
		}
		preview.body.scale.set(
			selectedShipType.scale,
			selectedShipType.scale,
			selectedShipType.scale
		);
	}

	// Update engine effect
	preview.engine.material.color.setHex(selectedEngine.color);
	preview.engine.scale.set(
		selectedEngine.intensity * 0.9,
		selectedEngine.intensity * 0.9,
		selectedEngine.intensity * 0.9
	);

	if (selectedFinish && preview.body.material) {
		preview.body.material.shininess = selectedFinish.shininess;
		preview.body.material.emissiveIntensity =
			selectedFinish.emissiveIntensity;
		if (previewMaterials) {
			previewMaterials.detail.shininess = selectedFinish.shininess;
		}
	}

	if (selectedNose) {
		const geometry = createAttachmentGeometry(
			selectedNose.shape,
			selectedNose.scale
		);
		if (geometry) {
			preview.nose.geometry.dispose();
			preview.nose.geometry = geometry;
			preview.nose.rotation.x = Math.PI / 2;
			preview.nose.position.z =
				selectedShipType && selectedShipType.offsets
					? selectedShipType.offsets.nose
					: selectedNose.offsetZ;
		}
	}

	if (selectedTail) {
		const geometry = createAttachmentGeometry(
			selectedTail.shape,
			selectedTail.scale
		);
		if (geometry) {
			preview.tail.geometry.dispose();
			preview.tail.geometry = geometry;
			preview.tail.rotation.x = Math.PI / 2;
			preview.tail.position.z =
				selectedShipType && selectedShipType.offsets
					? selectedShipType.offsets.tail
					: selectedTail.offsetZ;
		}
	}

	if (selectedWeapon) {
		const geometry = createAttachmentGeometry(
			selectedWeapon.shape,
			selectedWeapon.scale
		);
		if (geometry) {
			preview.weaponLeft.geometry.dispose();
			preview.weaponRight.geometry.dispose();
			preview.weaponLeft.geometry = geometry.clone();
			preview.weaponRight.geometry = geometry;
			preview.weaponLeft.rotation.z = Math.PI / 2;
			preview.weaponRight.rotation.z = Math.PI / 2;
			preview.weaponLeft.position.set(
				-selectedWeapon.offset.x,
				selectedWeapon.offset.y,
				selectedWeapon.offset.z
			);
			preview.weaponRight.position.set(
				selectedWeapon.offset.x,
				selectedWeapon.offset.y,
				selectedWeapon.offset.z
			);
		}
	}

	if (selectedDecal && previewMaterials) {
		previewMaterials.decal.color.setHex(selectedDecal.color);
		previewMaterials.decal.opacity = selectedDecal.opacity;
		preview.decal.visible = selectedDecal.opacity > 0.05;
	}

	if (selectedTrail) {
		applyTrailStyle(selectedTrail);
	}

	if (typeof lightingIndex === "number") {
		updatePreviewLighting(lightingIndex);
	}
}

// Get customization preferences from localStorage or use defaults
function getCustomizationPreferences() {
	const defaults = {
		colorIndex: 0, // Classic Blue (first unlocked option)
		wingIndex: 0, // Standard (first unlocked option)
		engineIndex: 0, // Blue Flame (first unlocked option)
		shipTypeIndex: getFirstUnlockedShipTypeIndex(),
		noseIndex: 0,
		tailIndex: 0,
		weaponIndex: 0,
		decalIndex: 0,
		finishIndex: 0,
		trailIndex: 0,
		lightingIndex: 0,
		autoRotate: true,
		rotateSpeed: 0.4,
		zoomLevel: 4.2,
		skinId: "none",
	};

	try {
		const saved = JSON.parse(localStorage.getItem("shipCustomization"));
		if (!saved) return defaults;
		return normalizeSelection({
			...defaults,
			...saved,
		});
	} catch (e) {
		return defaults;
	}
}

// Save customization preferences to localStorage
function saveCustomizationPreferences(
	colorIndex,
	wingIndex,
	engineIndex,
	shipTypeIndex,
	noseIndex,
	tailIndex,
	weaponIndex,
	decalIndex,
	finishIndex,
	trailIndex
) {
	const safeSelection =
		customizationSelection ||
		normalizeSelection(getCustomizationPreferences());
	const preferences = {
		colorIndex: colorIndex,
		wingIndex: wingIndex,
		engineIndex: engineIndex,
		shipTypeIndex: shipTypeIndex,
		noseIndex: noseIndex,
		tailIndex: tailIndex,
		weaponIndex: weaponIndex,
		decalIndex: decalIndex,
		finishIndex: finishIndex,
		trailIndex: trailIndex,
		lightingIndex: safeSelection.lightingIndex,
		skinId: safeSelection.skinId,
		autoRotate: safeSelection.autoRotate,
		rotateSpeed: safeSelection.rotateSpeed,
		zoomLevel: safeSelection.zoomLevel,
	};

	try {
		localStorage.setItem(
			"shipCustomization",
			JSON.stringify(preferences)
		);
	} catch (e) {
		// Ignore storage failures.
	}
	return preferences;
}

// Initialize the customization system
function initShipCustomization() {
	// Make sure Three.js is loaded before proceeding
	if (typeof THREE === "undefined") {
		console.error(
			"Three.js is required for ship customization but it's not loaded!"
		);
	}

	initializeCustomizationState();
	createCustomizationScreen();

	// Add event listener to show customization screen
	const customizeButton = document.getElementById("customizeShipButton");
	if (customizeButton) {
		customizeButton.addEventListener("click", openCustomizationScreen);
	}

	const startScreen = document.getElementById("startScreen");
	if (startScreen) {
		startScreen.addEventListener("click", (event) => {
			const target = event.target;
			if (
				target &&
				target.id === "customizeShipButton"
			) {
				openCustomizationScreen();
			}
		});
	}

	window.openCustomizationScreen = openCustomizationScreen;

	if (typeof THREE === "undefined") {
		setTimeout(() => {
			if (typeof THREE !== "undefined" && !window.previewElements) {
				setupShipPreview();
				applyShowroomSettings();
			}
		}, 500);
	}
}

function initLevelSelect() {
	const levelButton = document.getElementById("levelSelectButton");
	if (levelButton) {
		levelButton.addEventListener("click", openLevelSelect);
	}

	const closeButton = document.getElementById("closeLevelSelect");
	if (closeButton) {
		closeButton.addEventListener("click", closeLevelSelect);
	}

	const panel = document.getElementById("levelSelect");
	if (panel) {
		panel.addEventListener("click", (event) => {
			if (event.target === panel) {
				closeLevelSelect();
			}
		});
	}

	updateLevelBadge();
	renderLevelOptions();
}

// Add this function to initialize the ship with saved customizations when the game starts
function loadShipCustomizations() {
	const saved = normalizeSelection(getCustomizationPreferences());
	applyShipCustomization(
		saved.colorIndex,
		saved.wingIndex,
		saved.engineIndex,
		saved.shipTypeIndex,
		saved.noseIndex,
		saved.tailIndex,
		saved.weaponIndex,
		saved.decalIndex,
		saved.finishIndex,
		saved.trailIndex,
		true
	);
}

// Shield effect
const shieldGeometry = new THREE.SphereGeometry(1.5, 32, 32);
const shieldMaterial = new THREE.MeshBasicMaterial({
	color: 0x00aaff,
	transparent: true,
	opacity: 0,
	side: THREE.DoubleSide,
});
const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
shipGroup.add(shield);

// Particle systems
const particleSystem = new THREE.Group();
scene.add(particleSystem);

// Engine trail particles
function createEngineTrail() {
	const trailGeometry = new THREE.BufferGeometry();
	const trailVertices = [];
	const trailColors = [];

	for (let i = 0; i < 100; i++) {
		trailVertices.push(0, 0, 0); // Will be updated in animation

		// Blue-cyan gradient
		trailColors.push(0, 0.8 + Math.random() * 0.2, 1);
	}

	trailGeometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(trailVertices, 3)
	);
	trailGeometry.setAttribute(
		"color",
		new THREE.Float32BufferAttribute(trailColors, 3)
	);

	const trailMaterial = new THREE.PointsMaterial({
		size: 0.2,
		vertexColors: true,
		transparent: true,
		opacity: 0.7,
	});

	const trail = new THREE.Points(trailGeometry, trailMaterial);
	particleSystem.add(trail);

	return {
		mesh: trail,
		vertices: trailVertices,
		colors: trailColors,
		material: trailMaterial,
		update: function (shipPosition) {
			const positions = trail.geometry.attributes.position.array;

			// Shift all particles back
			for (let i = positions.length - 3; i >= 3; i -= 3) {
				positions[i] = positions[i - 3];
				positions[i + 1] = positions[i - 2];
				positions[i + 2] = positions[i - 1];
			}

			// Add new particle at ship position
			positions[0] = shipPosition.x;
			positions[1] = shipPosition.y - 1;
			positions[2] = shipPosition.z;

			trail.geometry.attributes.position.needsUpdate = true;
		},
	};
}

const engineTrail = createEngineTrail();

function applyTrailStyle(trailStyle) {
	if (!trailStyle || !engineTrail) return;
	engineTrail.material.size = trailStyle.size;
	engineTrail.material.opacity = trailStyle.opacity;

	const color = new THREE.Color(trailStyle.color);
	const colors =
		engineTrail.mesh.geometry.attributes.color.array;
	for (let i = 0; i < colors.length; i += 3) {
		colors[i] = color.r;
		colors[i + 1] = color.g;
		colors[i + 2] = color.b;
	}
	engineTrail.mesh.geometry.attributes.color.needsUpdate = true;
}

// Power-ups - enhanced with glowing effect
const powerUps = [];
const powerUpPool = [];
const MAX_POWERUP_POOL = 8;
const powerUpGeometry = new THREE.OctahedronGeometry(0.7);
const powerUpMaterial = new THREE.MeshPhongMaterial({
	color: 0xffcc00,
	emissive: 0x553300,
	shininess: 100,
});

function resetPowerUp(powerUp) {
	powerUp.position.set(
		(Math.random() - 0.5) * 15,
		(Math.random() - 0.5) * 15,
		-150 - Math.random() * 500
	);

	powerUp.rotation.set(
		Math.random() * Math.PI * 2,
		Math.random() * Math.PI * 2,
		Math.random() * Math.PI * 2
	);

	powerUp.rotationSpeed = {
		x: Math.random() * 0.03,
		y: Math.random() * 0.03,
		z: Math.random() * 0.03,
	};

	powerUp.pulseSpeed = Math.random() * 0.1 + 0.05;
	powerUp.pulsePhase = Math.random() * Math.PI * 2;
	powerUp.visible = true;
}

function createPowerUp() {
	let powerUp = powerUpPool.pop();
	if (!powerUp) {
		powerUp = new THREE.Group();

		const core = new THREE.Mesh(
			powerUpGeometry.clone(),
			powerUpMaterial.clone()
		);
		powerUp.add(core);

		const glowGeometry = new THREE.OctahedronGeometry(1);
		const glowMaterial = new THREE.MeshBasicMaterial({
			color: 0xffcc00,
			transparent: true,
			opacity: 0.3,
		});
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		powerUp.add(glow);

		const powerUpLight = new THREE.PointLight(0xffcc00, 1, 10);
		powerUp.add(powerUpLight);
	}

	resetPowerUp(powerUp);
	scene.add(powerUp);
	powerUps.push(powerUp);
	return powerUp;
}

function releasePowerUp(powerUp) {
	scene.remove(powerUp);
	powerUp.visible = false;
	if (powerUpPool.length < MAX_POWERUP_POOL) {
		powerUpPool.push(powerUp);
	} else {
		disposeObject3D(powerUp);
	}
}

// Asteroids - enhanced with more variety and details
const asteroids = [];
const asteroidPool = [];
const MAX_ASTEROID_POOL = 40;
const asteroidGeometries = [
	new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.8),
	new THREE.DodecahedronGeometry(Math.random() * 0.5 + 0.8),
	new THREE.TetrahedronGeometry(Math.random() * 0.5 + 1),
	new THREE.TorusGeometry(Math.random() * 0.5 + 0.8, 0.3, 16, 8),
];

const asteroidTextures = [
	new THREE.MeshStandardMaterial({
		color: 0x888888,
		roughness: 0.9,
		metalness: 0.1,
	}),
	new THREE.MeshStandardMaterial({
		color: 0xaa8866,
		roughness: 0.8,
		metalness: 0.2,
	}),
	new THREE.MeshStandardMaterial({
		color: 0x777755,
		roughness: 0.7,
		metalness: 0.3,
	}),
];

function resetAsteroid(asteroid) {
	const geometry =
		asteroidGeometries[
			Math.floor(Math.random() * asteroidGeometries.length)
		];
	const material =
		asteroidTextures[Math.floor(Math.random() * asteroidTextures.length)];

	if (asteroid.material) {
		disposeMaterial(asteroid.material);
	}
	if (asteroid.geometry && asteroid.geometry.dispose) {
		asteroid.geometry.dispose();
	}
	asteroid.geometry = geometry.clone();
	asteroid.material = material.clone();

	// Random position
	asteroid.position.set(
		(Math.random() - 0.5) * 25,
		(Math.random() - 0.5) * 25,
		-150 - Math.random() * 50
	);

	// Random rotation
	asteroid.rotation.set(
		Math.random() * Math.PI * 2,
		Math.random() * Math.PI * 2,
		Math.random() * Math.PI * 2
	);

	// Random rotation speed
	asteroid.rotationSpeed = {
		x: Math.random() * 0.03 - 0.015,
		y: Math.random() * 0.03 - 0.015,
		z: Math.random() * 0.03 - 0.015,
	};

	// Random scale for more variety
	const scale = Math.random() * 1.8 + 0.7;
	asteroid.scale.set(scale, scale, scale);

	// Add some uniqueness to each asteroid
	if (Math.random() > 0.7) {
		asteroid.material.color.setHSL(0, 0, Math.random() * 0.2 + 0.3);
	}

	asteroid.visible = true;
}

function createAsteroid() {
	let asteroid = asteroidPool.pop();
	if (!asteroid) {
		asteroid = new THREE.Mesh(
			asteroidGeometries[0].clone(),
			asteroidTextures[0].clone()
		);
	}
	resetAsteroid(asteroid);
	scene.add(asteroid);
	asteroids.push(asteroid);

	return asteroid;
}

function releaseAsteroid(asteroid) {
	scene.remove(asteroid);
	asteroid.visible = false;
	if (asteroidPool.length < MAX_ASTEROID_POOL) {
		asteroidPool.push(asteroid);
	} else {
		disposeObject3D(asteroid);
	}
}

// Create asteroid field clusters
function createAsteroidCluster() {
	const clusterSize = Math.floor(Math.random() * 3) + 3;
	const centerX = (Math.random() - 0.5) * 15;
	const centerY = (Math.random() - 0.5) * 15;
	const centerZ = -150 - Math.random() * 50;

	for (let i = 0; i < clusterSize; i++) {
		const asteroid = createAsteroid();
		asteroid.position.set(
			centerX + (Math.random() - 0.5) * 10,
			centerY + (Math.random() - 0.5) * 10,
			centerZ + (Math.random() - 0.5) * 10
		);
	}

	// Add cluster notification
	showNotification("Asteroid cluster detected!");
}

// Camera and player setup
camera.position.z = 5;

// Notifications system
function showNotification(text) {
	const notification = document.createElement("div");
	notification.className = "notification";
	notification.textContent = text;
	document.body.appendChild(notification);

	// Animate in
	setTimeout(() => {
		notification.style.transform = "translateX(0)";
	}, 10);

	// Animate out and remove
	setTimeout(() => {
		notification.style.transform = "translateX(120%)";
		setTimeout(() => {
			document.body.removeChild(notification);
		}, 500);
	}, 3000);
}

const statusState = {
	shield: false,
	boost: false,
	brake: false,
};

function createStatusPanel() {
	const ui = document.getElementById("ui");
	if (!ui) return null;

	const panel = document.createElement("div");
	panel.className = "status-panel";
	panel.innerHTML = `
		<div class="status-badge status-badge--shield" data-status="shield">Shield</div>
		<div class="status-badge status-badge--boost" data-status="boost">Boost</div>
		<div class="status-badge status-badge--brake" data-status="brake">Brake</div>
	`;
	ui.appendChild(panel);
	return panel;
}

const statusPanel = createStatusPanel();

function setStatusActive(key, isActive) {
	statusState[key] = isActive;
	if (!statusPanel) return;
	const badge = statusPanel.querySelector(
		`.status-badge[data-status="${key}"]`
	);
	if (badge) {
		badge.classList.toggle("status-badge--active", isActive);
	}
}

// Dramatic warp effect
function triggerWarpEffect() {
	const warpEffect = document.getElementById("warpEffect");
	warpEffect.style.opacity = "0.7";

	setTimeout(() => {
		warpEffect.style.opacity = "0";
	}, 1000);
}

function disposeMaterial(material) {
	if (Array.isArray(material)) {
		material.forEach((mat) => mat && mat.dispose && mat.dispose());
		return;
	}
	if (material && material.dispose) {
		material.dispose();
	}
}

function disposeObject3D(object) {
	if (!object) return;
	object.traverse((child) => {
		if (child.geometry && child.geometry.dispose) {
			child.geometry.dispose();
		}
		if (child.material) {
			disposeMaterial(child.material);
		}
	});
}

// Enhanced explosion effect with debris
function createExplosion(position, color, size) {
	// Main explosion flash
	const explosionGeometry = new THREE.SphereGeometry(size, 16, 16);
	const explosionMaterial = new THREE.MeshBasicMaterial({
		color: color,
		transparent: true,
		opacity: 1,
	});
	const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
	explosion.position.copy(position);
	scene.add(explosion);

	// Add light flash
	const explosionLight = new THREE.PointLight(color, 2, 10);
	explosionLight.position.copy(position);
	scene.add(explosionLight);

	// Create debris particles
	const debrisCount = Math.floor(size * 20);
	const debrisGeometry = new THREE.BufferGeometry();
	const debrisPositions = [];
	const debrisVelocities = [];

	for (let i = 0; i < debrisCount; i++) {
		debrisPositions.push(position.x, position.y, position.z);

		// Random velocity in all directions
		debrisVelocities.push(
			(Math.random() - 0.5) * 0.2,
			(Math.random() - 0.5) * 0.2,
			(Math.random() - 0.5) * 0.2
		);
	}

	debrisGeometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(debrisPositions, 3)
	);

	const debrisMaterial = new THREE.PointsMaterial({
		color: color,
		size: 0.1,
		transparent: true,
		opacity: 1,
	});

	const debris = new THREE.Points(debrisGeometry, debrisMaterial);
	scene.add(debris);

	// Animate and remove
	const startTime = Date.now();
	function animateExplosion() {
		const elapsed = Date.now() - startTime;
		const duration = 1000; // ms

		if (elapsed < duration) {
			// Expand explosion
			const scale = 1 + (elapsed / duration) * 3;
			explosion.scale.set(scale, scale, scale);
			explosion.material.opacity = 1 - elapsed / duration;

			// Fade light
			explosionLight.intensity = 2 * (1 - elapsed / duration);

			// Move debris
			const positions = debris.geometry.attributes.position.array;
			for (let i = 0; i < positions.length; i += 3) {
				positions[i] += debrisVelocities[i];
				positions[i + 1] += debrisVelocities[i + 1];
				positions[i + 2] += debrisVelocities[i + 2];
			}
			debris.geometry.attributes.position.needsUpdate = true;

			// Fade debris
			debris.material.opacity = 1 - elapsed / duration;

			requestAnimationFrame(animateExplosion);
		} else {
			scene.remove(explosion);
			scene.remove(explosionLight);
			scene.remove(debris);
			disposeObject3D(explosion);
			disposeObject3D(debris);
		}
	}
	animateExplosion();
}

// Collision detection
function checkCollisions() {
	const shipPosition = shipGroup.position.clone();
	const shipRadius = 0.8;

	// Check asteroid collisions
	for (let i = 0; i < asteroids.length; i++) {
		const asteroid = asteroids[i];
		const distance = shipPosition.distanceTo(asteroid.position);
		const collisionThreshold = shipRadius + asteroid.scale.x * 0.5;

		// Near miss detection for dramatic effect
		if (
			distance < collisionThreshold * 2 &&
			distance > collisionThreshold
		) {
			// Make danger light pulse
			dangerLight.intensity =
				(collisionThreshold * 2 - distance) / collisionThreshold;
			dangerLight.position.copy(asteroid.position);
		}

		if (distance < collisionThreshold) {
			endGame();
			return;
		}
	}

	// Reset danger light if no near misses
	dangerLight.intensity *= 0.9;

	// Check power-up collisions
	for (let i = 0; i < powerUps.length; i++) {
		const powerUp = powerUps[i];
		const distance = shipPosition.distanceTo(powerUp.position);

		if (distance < 1.5) {
			// Collect power-up
			releasePowerUp(powerUp);
			powerUps.splice(i, 1);
			i--;

			// Random bonus type
			const bonusType = Math.random();
			let bonusScore = 100;
			let effectColor = 0xffcc00;
			let message = "+100 points!";

			if (bonusType > 0.8) {
				// Super bonus
				bonusScore = 500;
				effectColor = 0xff9900;
				message = "SUPER BONUS: +500 points!";
			} else if (bonusType > 0.6) {
				// Shield effect
				activateShield();
				bonusScore = 250;
				effectColor = 0x00ffff;
				message = "Shield activated! +250 points!";
			}

			// Increase score
			score += bonusScore;
			document.getElementById("score").textContent = score;

			// Show notification
			showNotification(message);

			// Visual feedback
			createExplosion(powerUp.position.clone(), effectColor, 1);
		}
	}
}

// Shield activation
function activateShield() {
	shield.material.opacity = 0.5;
	setStatusActive("shield", true);

	// Animate shield
	const startTime = Date.now();
	function animateShield() {
		const elapsed = Date.now() - startTime;
		const duration = 5000; // ms

		if (elapsed < duration) {
			// Pulse effect
			const pulse = 0.3 + 0.2 * Math.sin(elapsed / 200);
			shield.material.opacity = pulse * (1 - elapsed / duration);

			requestAnimationFrame(animateShield);
		} else {
			shield.material.opacity = 0;
			setStatusActive("shield", false);
		}
	}
	animateShield();
}

function getTargetAsteroidCount() {
	const base = currentLevelConfig
		? currentLevelConfig.startAsteroids
		: 8;
	const bonus = Math.floor(level * 0.8);
	return Math.min(34, base + bonus);
}

function getPowerUpSpawnChance() {
	const baseChance = 0.0035;
	const penalty = Math.min(0.002, level * 0.0001);
	return Math.max(0.0015, baseChance - penalty);
}

// Game progression with dramatic effects
function updateDifficulty() {
	if (stageModeActive && currentLevelConfig) {
		const bonus = Math.floor(score / 1000) * 0.1;
		speed = currentLevelConfig.startSpeed + bonus;
		document.getElementById("speed").textContent = speed.toFixed(1);
		return;
	}
	if (score >= level * 1000) {
		level++;
		speed = Math.min(6.5, 1 + (level - 1) * 0.25);

		document.getElementById("level").textContent = level;
		document.getElementById("speed").textContent = speed.toFixed(1);

		// Show level up message with animation
		const levelUpMsg = document.getElementById("levelUp");
		levelUpMsg.textContent = `LEVEL ${level}!`;
		levelUpMsg.style.transform = "translate(-50%, -50%) scale(1)";
		levelUpMsg.style.opacity = "0.8";

		setTimeout(() => {
			levelUpMsg.style.transform = "translate(-50%, -50%) scale(2)";
			levelUpMsg.style.opacity = "0";
		}, 1000);

		// Visual feedback for level up
		createExplosion(new THREE.Vector3(0, 0, -5), 0x00ffff, 5);

		// Dramatic warp effect
		triggerWarpEffect();

		checkLevelUnlocks(level);

		// Add asteroid cluster at certain levels
		if (level % 2 === 0) {
			createAsteroidCluster();
		}

		// Play sound effect - simulated with console message
		console.log("Level up sound effect played");
	}
}

// Game end with dramatic effects
function endGame() {
	gameActive = false;
	gameOver = true;
	stageCleared = false;
	if (stageAutoAdvanceTimer) {
		clearTimeout(stageAutoAdvanceTimer);
		stageAutoAdvanceTimer = null;
	}
	addCredits(score);
	const isBestScore = recordHighScore({
		score,
		level,
		date: Date.now(),
	});
	renderLeaderboard();
	document.getElementById("finalScore").textContent = score;
	document.getElementById("gameOver").style.display = "block";
	hidePauseMenu();
	hideStageClear();
	setStatusActive("shield", false);
	setStatusActive("boost", false);
	setStatusActive("brake", false);

	if (isBestScore) {
		showNotification("New high score!");
	}

	// Massive explosion effect
	createExplosion(shipGroup.position.clone(), 0xff0000, 3);

	// Create secondary explosions
	setTimeout(() => {
		createExplosion(
			new THREE.Vector3(
				shipGroup.position.x + (Math.random() - 0.5) * 2,
				shipGroup.position.y + (Math.random() - 0.5) * 2,
				shipGroup.position.z + (Math.random() - 0.5) * 2
			),
			0xff3300,
			2
		);
	}, 300);

	setTimeout(() => {
		createExplosion(
			new THREE.Vector3(
				shipGroup.position.x + (Math.random() - 0.5) * 2,
				shipGroup.position.y + (Math.random() - 0.5) * 2,
				shipGroup.position.z + (Math.random() - 0.5) * 2
			),
			0xff9900,
			1.5
		);
	}, 600);

	// Hide ship
	shipGroup.visible = false;
}

// Start game
function startGame() {
	// Hide start screen
	document.getElementById("startScreen").style.display = "none";
	hidePauseMenu();
	hideStageClear();

	currentLevelConfig =
		levelConfigs[selectedLevelIndex] || levelConfigs[0];

	// Reset game state
	score = currentLevelConfig.startScore;
	level = currentLevelConfig.id;
	speed = currentLevelConfig.startSpeed;
	gamePaused = false;
	previousSpeed = 0;
	gameActive = true;
	gameOver = false;
	stageCleared = false;
	levelStartTime = Date.now();
	inputController.resetInput();
	setStatusActive("shield", false);
	setStatusActive("boost", false);
	setStatusActive("brake", false);

	document.getElementById("score").textContent = String(score);
	document.getElementById("level").textContent = String(level);
	document.getElementById("speed").textContent = speed.toFixed(1);

	checkLevelUnlocks(level);

	// Hide game over screen
	document.getElementById("gameOver").style.display = "none";

	// Show ship
	shipGroup.visible = true;

	// Reset ship position
	shipGroup.position.set(0, 0, 0);

	// Clear existing objects
	for (let i = asteroids.length - 1; i >= 0; i--) {
		releaseAsteroid(asteroids[i]);
		asteroids.splice(i, 1);
	}

	for (let i = powerUps.length - 1; i >= 0; i--) {
		releasePowerUp(powerUps[i]);
		powerUps.splice(i, 1);
	}

	// Initial objects
	const targetAsteroids = getTargetAsteroidCount();
	for (let i = 0; i < targetAsteroids; i++) {
		createAsteroid();
	}

	for (let i = 0; i < 3; i++) {
		createPowerUp();
	}

	// Show welcome message
	showNotification("Mission started! Good luck, pilot!");

	// Start animation if not already running
	if (!animationRunning) {
		animationRunning = true;
		animate();
	}
}

function showPauseMenu() {
	const pauseMenu = document.getElementById("pauseMenu");
	if (pauseMenu) {
		pauseMenu.style.display = "flex";
	}
}

function hidePauseMenu() {
	const pauseMenu = document.getElementById("pauseMenu");
	if (pauseMenu) {
		pauseMenu.style.display = "none";
	}
}

function showStageClear(metaText) {
	const stageClear = document.getElementById("stageClear");
	const meta = document.getElementById("stageClearMeta");
	const nextButton = document.getElementById("nextStageButton");
	const homeButton = document.getElementById("stageHomeButton");
	if (!stageClear) return;

	stageClear.style.display = "flex";
	if (meta) {
		meta.textContent = metaText;
	}

	const isLast =
		selectedLevelIndex >= levelConfigs.length - 1;

	if (nextButton) {
		nextButton.style.display = isLast ? "none" : "inline-flex";
		nextButton.onclick = () => {
			goToNextStage();
		};
	}

	if (homeButton) {
		homeButton.onclick = () => {
			closeStageClearToHome();
		};
	}

	if (!isLast) {
		stageAutoAdvanceTimer = setTimeout(() => {
			goToNextStage();
		}, 3000);
	}
}

function hideStageClear() {
	const stageClear = document.getElementById("stageClear");
	if (stageClear) {
		stageClear.style.display = "none";
	}
}

function closeStageClearToHome() {
	if (stageAutoAdvanceTimer) {
		clearTimeout(stageAutoAdvanceTimer);
		stageAutoAdvanceTimer = null;
	}
	hideStageClear();
	document.getElementById("startScreen").style.display = "flex";
	gameActive = false;
	gamePaused = false;
	speed = 0;
}

function goToNextStage() {
	if (stageAutoAdvanceTimer) {
		clearTimeout(stageAutoAdvanceTimer);
		stageAutoAdvanceTimer = null;
	}
	hideStageClear();
	selectedLevelIndex = Math.min(
		selectedLevelIndex + 1,
		levelConfigs.length - 1
	);
	updateLevelBadge();
	startGame();
}
function pauseGame(options = {}) {
	const {
		showMenu = true,
		message = "Game Paused - Press ESC to resume",
	} = options;

	if (!gameActive || gamePaused || gameOver) return false;

	previousSpeed = speed;
	speed = 0;
	gamePaused = true;
	if (message) {
		showNotification(message);
	}
	if (showMenu) {
		showPauseMenu();
	} else {
		hidePauseMenu();
	}
	return true;
}
function resumeGame() {
	if (!gameActive || !gamePaused || gameOver) return;
	speed = previousSpeed;
	gamePaused = false;
	hidePauseMenu();
	showNotification("Game Resumed");
}

function goToHome() {
	gameActive = false;
	gamePaused = false;
	previousSpeed = 0;
	speed = 0;
	hidePauseMenu();
	document.getElementById("gameOver").style.display = "none";
	document.getElementById("startScreen").style.display = "flex";
}

// Event listeners
document.getElementById("startButton").addEventListener("click", startGame);
document.getElementById("restartButton").addEventListener("click", startGame);
document.getElementById("resumeButton").addEventListener("click", resumeGame);
document.getElementById("homeButton").addEventListener("click", goToHome);

// Window resize handler
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		pauseGame({ showMenu: true, message: "Paused - tab inactive" });
	}
});

window.addEventListener("blur", () => {
	pauseGame({ showMenu: true, message: "Paused - focus lost" });
});

// Animation loop
let animationRunning = false;
function animate() {
	requestAnimationFrame(animate);
	const delta = clock.getDelta();
	const frameScale = Math.min(2, delta * 60);

	// Rotate stars slightly for parallax effect
	stars.rotation.y -= 0.0001 * frameScale;
	stars.rotation.z -= 0.0001 * frameScale;

	// Update engine glow with pulsing effect
	const pulseValue = (Math.sin(Date.now() * 0.005) + 1) / 2;
	engineGlowMaterial.opacity = 0.5 + pulseValue * 0.5;
	engineLight.intensity = 0.8 + pulseValue * 0.4;

	if (gameActive && !gamePaused) {
		// Move ship based on input - with smooth easing
		const inputVector = inputController.getInputVector();
		const targetX = inputVector.x * 10;
		const targetY = inputVector.y * 5;

		const smoothing = Math.min(0.2, 0.08 * frameScale);
		shipGroup.position.x +=
			(targetX - shipGroup.position.x) * smoothing;
		shipGroup.position.y +=
			(targetY - shipGroup.position.y) * smoothing;

		// Ship tilt based on movement
		const targetTiltX = (targetY - shipGroup.position.y) * -0.5;
		const targetTiltZ = (targetX - shipGroup.position.x) * -0.3;

		shipGroup.rotation.x +=
			(targetTiltX - shipGroup.rotation.x) * smoothing;
		shipGroup.rotation.z +=
			(targetTiltZ - shipGroup.rotation.z) * smoothing;

		// Update engine trail
		engineTrail.update(shipGroup.position);

		// Move and rotate asteroids
		for (let i = 0; i < asteroids.length; i++) {
			const asteroid = asteroids[i];

			// Move toward player with increasing speed
			asteroid.position.z += speed * 0.5 * frameScale;

			// Rotate
			asteroid.rotation.x +=
				asteroid.rotationSpeed.x * frameScale;
			asteroid.rotation.y +=
				asteroid.rotationSpeed.y * frameScale;
			asteroid.rotation.z +=
				asteroid.rotationSpeed.z * frameScale;

			// Remove if past camera and create new ones
			if (asteroid.position.z > 10) {
				releaseAsteroid(asteroid);
				asteroids.splice(i, 1);
				i--;

				// Create new asteroid
				const targetAsteroids = getTargetAsteroidCount();
				if (asteroids.length < targetAsteroids) {
					createAsteroid();
				}

				// Increment score
				score += 10;
				document.getElementById("score").textContent = score;
			}
		}

		// Move and animate power-ups
		for (let i = 0; i < powerUps.length; i++) {
			const powerUp = powerUps[i];

			// Move toward player
			powerUp.position.z += speed * 0.3 * frameScale;

			// Rotate
			powerUp.rotation.x += powerUp.rotationSpeed.x * frameScale;
			powerUp.rotation.y += powerUp.rotationSpeed.y * frameScale;
			powerUp.rotation.z += powerUp.rotationSpeed.z * frameScale;

			// Pulsing glow effect
			const pulse = Math.sin(
				Date.now() * powerUp.pulseSpeed + powerUp.pulsePhase
			);
			powerUp.children[1].scale.set(
				1 + pulse * 0.2,
				1 + pulse * 0.2,
				1 + pulse * 0.2
			);

			// Remove if past camera
			if (powerUp.position.z > 10) {
				releasePowerUp(powerUp);
				powerUps.splice(i, 1);
				i--;

				// Create new power-up with random probability
				if (Math.random() < getPowerUpSpawnChance()) {
					createPowerUp();
				}
			}
		}

		// Randomly spawn new power-ups
		if (powerUps.length < 3 && Math.random() < getPowerUpSpawnChance()) {
			createPowerUp();
		}

		// Check for collisions
		checkCollisions();

		// Update game difficulty based on score
		updateDifficulty();

		// Check stage clear conditions
		if (stageModeActive && currentLevelConfig && !stageCleared) {
			const elapsed =
				(Date.now() - levelStartTime) / 1000;
			const targetMet = score >= currentLevelConfig.targetScore;
			const timeMet = elapsed >= currentLevelConfig.duration;
			if (targetMet && timeMet) {
				stageCleared = true;
				gameActive = false;
				speed = 0;
				showStageClear(
					`Cleared ${currentLevelConfig.name} · Time ${Math.floor(
						elapsed
					)}s · Score ${score}`
				);
			}
		}

		// Move and rotate distant objects slowly
		for (let i = 0; i < distantObjects.length; i++) {
			const obj = distantObjects[i];
			obj.rotation.y += 0.001;
			// Extremely slow movement for distant parallax effect
			obj.position.z += speed * 0.01;

			// Reset position if too close
			if (obj.position.z > 0) {
				obj.position.z = -800;
			}
		}
	}

	// Render scene
	renderer.render(scene, camera);
}

// Start the animation loop
animationRunning = true;
animate();

// Add some extra features for advanced gameplay

// Add cooldown system for special maneuvers
const cooldowns = {
	barrelRoll: {
		active: false,
		duration: 2000, // 2 seconds cooldown
		lastUsed: 0,
	},
	boost: {
		active: false,
		duration: 5000, // 5 seconds cooldown
		lastUsed: 0,
	},
	brake: {
		active: false,
		duration: 5000, // 5 seconds cooldown
		lastUsed: 0,
	},
	energyWave: {
		active: false,
		duration: 10000, // 10 seconds cooldown
		lastUsed: 0,
	},
};
const energyWaveCost = 500;

function checkCooldown(ability) {
	const now = Date.now();
	if (cooldowns[ability].active) {
		const elapsed = now - cooldowns[ability].lastUsed;
		if (elapsed < cooldowns[ability].duration) {
			// Still on cooldown, return remaining time
			return cooldowns[ability].duration - elapsed;
		}
	}

	// Not on cooldown, activate it
	cooldowns[ability].active = true;
	cooldowns[ability].lastUsed = now;
	return 0;
}

// Special maneuvers with keyboard controls
document.addEventListener("keydown", function (event) {
	// Pause/unpause with Escape key
	if (event.key === "Escape" && gameActive && !gameOver) {
		if (!gamePaused) {
			pauseGame();
		} else {
			resumeGame();
		}
		return;
	}

	if (!gameActive || gamePaused) return;

	// Barrel roll right
	if (event.key === "d" || event.key === "D") {
		const remainingCooldown = checkCooldown("barrelRoll");
		if (remainingCooldown === 0) {
			performBarrelRoll(1);
			showNotification("Barrel Roll Right!");
			// Create cooldown indicator
			createCooldownIndicator("barrelRoll", "D");
		} else {
			showNotification(
				`Barrel Roll on cooldown: ${(remainingCooldown / 1000).toFixed(
					1
				)}s`
			);
		}
	}

	// Barrel roll left
	if (event.key === "a" || event.key === "A") {
		const remainingCooldown = checkCooldown("barrelRoll");
		if (remainingCooldown === 0) {
			performBarrelRoll(-1);
			showNotification("Barrel Roll Left!");
			// Create cooldown indicator
			createCooldownIndicator("barrelRoll", "A");
		} else {
			showNotification(
				`Barrel Roll on cooldown: ${(remainingCooldown / 1000).toFixed(
					1
				)}s`
			);
		}
	}

	// Quick boost
	if (event.key === "w" || event.key === "W") {
		const remainingCooldown = checkCooldown("boost");
		if (remainingCooldown === 0) {
			performBoost();
			showNotification("Speed Boost Activated!");
			// Create cooldown indicator
			createCooldownIndicator("boost", "W");
		} else {
			showNotification(
				`Boost on cooldown: ${(remainingCooldown / 1000).toFixed(1)}s`
			);
		}
	}

	// Emergency brake
	if (event.key === "s" || event.key === "S") {
		const remainingCooldown = checkCooldown("brake");
		if (remainingCooldown === 0) {
			performBrake();
			showNotification("Emergency Brake!");
			// Create cooldown indicator
			createCooldownIndicator("brake", "S");
		} else {
			showNotification(
				`Brake on cooldown: ${(remainingCooldown / 1000).toFixed(1)}s`
			);
		}
	}

	// Special attack - clear nearby asteroids
	if (event.key === " ") {
		const remainingCooldown = checkCooldown("energyWave");
		// if (remainingCooldown === 0) {
		if (remainingCooldown == 0) {
			if (score >= energyWaveCost) {
				clearNearbyAsteroids();
				score -= energyWaveCost;
				document.getElementById("score").textContent = score;
				showNotification(
					`Energy Wave Deployed! -${energyWaveCost} points`
				);
				// Create cooldown indicator
				createCooldownIndicator("energyWave", "SPACE");
			} else {
				cooldowns["energyWave"].active = false; // Reset cooldown if not enough points
				showNotification(
					`Insufficient energy! Need ${energyWaveCost} points!`
				);
			}
		} else {
			showNotification(
				`Energy Wave on cooldown: ${(remainingCooldown / 1000).toFixed(
					1
				)}s`
			);
		}
	}

});

// Create visual cooldown indicators
function createCooldownIndicator(ability, keyLabel) {
	// Create or update cooldown UI
	let indicator = document.getElementById(`cooldown-${ability}`);

	if (!indicator) {
		// Create new indicator if it doesn't exist
		indicator = document.createElement("div");
		indicator.id = `cooldown-${ability}`;
		indicator.className = "cooldown-indicator";

		// Position indicators on the right side with some spacing
		const indicatorTop = 130 + Object.keys(cooldowns).indexOf(ability) * 60;

		indicator.style.cssText = `
                position: absolute;
                right: 20px;
                top: ${indicatorTop}px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.5);
                border: 2px solid rgba(0, 150, 255, 0.7);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 16px;
                font-weight: bold;
                overflow: hidden;
            `;

		// Key label
		const label = document.createElement("div");
		label.textContent = keyLabel;
		indicator.appendChild(label);

		// Fill element for the cooldown visual
		const fill = document.createElement("div");
		fill.className = "cooldown-fill";
		fill.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                background: rgba(0, 150, 255, 0.5);
                height: 100%;
                transform-origin: bottom;
                z-index: -1;
            `;
		indicator.appendChild(fill);

		document.body.appendChild(indicator);
	}

	// Animate the cooldown
	const fill = indicator.querySelector(".cooldown-fill");
	fill.style.transition = `transform ${
		cooldowns[ability].duration / 1000
	}s linear`;
	fill.style.transform = "scaleY(0)";

	// Reset after cooldown
	setTimeout(() => {
		if (indicator && indicator.parentNode) {
			document.body.removeChild(indicator);
		}
	}, cooldowns[ability].duration);
}

// Add CSS for cooldown indicators to the head
const cooldownStyle = document.createElement("style");
cooldownStyle.textContent = `
        .cooldown-indicator {
            box-shadow: 0 0 15px rgba(0, 150, 255, 0.5);
            transition: all 0.3s ease;
        }
        .cooldown-indicator:hover {
            transform: scale(1.1);
        }
    `;
document.head.appendChild(cooldownStyle);

// Reset all cooldowns when starting/restarting game
const originalStartGame = startGame;
startGame = function () {
	// Reset all cooldowns
	for (const ability in cooldowns) {
		cooldowns[ability].active = false;
		cooldowns[ability].lastUsed = 0;

		// Remove any lingering cooldown indicators
		const indicator = document.getElementById(`cooldown-${ability}`);
		if (indicator && indicator.parentNode) {
			document.body.removeChild(indicator);
		}
	}

	// Call original startGame function
	originalStartGame();
};

// Barrel roll animation
function performBarrelRoll(direction) {
	const startRotation = shipGroup.rotation.z;
	const startTime = Date.now();
	const duration = 1000; // ms

	function animateRoll() {
		const elapsed = Date.now() - startTime;

		if (elapsed < duration) {
			// Rotate around z-axis
			const progress = elapsed / duration;
			shipGroup.rotation.z =
				startRotation + direction * Math.PI * 2 * progress;

			requestAnimationFrame(animateRoll);
		} else {
			// Reset to original rotation
			shipGroup.rotation.z = startRotation;
		}
	}

	animateRoll();
}

// Quick boost animation
function performBoost() {
	const startTime = Date.now();
	const duration = 1000; // ms
	const originalSpeed = speed;
	setStatusActive("boost", true);

	// Visual effect
	engineGlowMaterial.color.set(0xff9900);
	engineLight.color.set(0xff9900);
	triggerWarpEffect();

	function animateBoost() {
		const elapsed = Date.now() - startTime;

		if (elapsed < duration) {
			// Increase speed temporarily
			speed = originalSpeed * 2;

			// Visual stretch effect
			const progress = elapsed / duration;
			const stretch = 1 + Math.sin(progress * Math.PI) * 0.3;
			shipGroup.scale.z = stretch;

			requestAnimationFrame(animateBoost);
		} else {
			// Reset
			speed = originalSpeed;
			shipGroup.scale.z = 1;
			engineGlowMaterial.color.set(0x00ffff);
			engineLight.color.set(0x00ffff);
			setStatusActive("boost", false);
		}
	}

	animateBoost();
}

// Emergency brake animation
function performBrake() {
	const startTime = Date.now();
	const duration = 1000; // ms
	const originalSpeed = speed;
	setStatusActive("brake", true);

	// Visual effect
	engineGlowMaterial.color.set(0xff3333);
	engineLight.color.set(0xff3333);

	function animateBrake() {
		const elapsed = Date.now() - startTime;

		if (elapsed < duration) {
			// Decrease speed temporarily
			speed = originalSpeed * 0.3;

			requestAnimationFrame(animateBrake);
		} else {
			// Reset
			speed = originalSpeed;
			engineGlowMaterial.color.set(0x00ffff);
			engineLight.color.set(0x00ffff);
			setStatusActive("brake", false);
		}
	}

	animateBrake();
}

// Special attack - clear nearby asteroids
function clearNearbyAsteroids() {
	// Create expanding energy wave
	const waveGeometry = new THREE.SphereGeometry(1, 32, 32);
	const waveMaterial = new THREE.MeshBasicMaterial({
		color: 0x00ffff,
		transparent: true,
		opacity: 0.7,
		wireframe: true,
	});
	const wave = new THREE.Mesh(waveGeometry, waveMaterial);
	wave.position.copy(shipGroup.position);
	scene.add(wave);

	// Wave animation
	const startTime = Date.now();
	const duration = 1000; // ms

	function animateWave() {
		const elapsed = Date.now() - startTime;

		if (elapsed < duration) {
			// Expand wave
			const scale = (elapsed / duration) * 20;
			wave.scale.set(scale, scale, scale);
			wave.material.opacity = 0.7 * (1 - elapsed / duration);

			// Check for asteroids within range
			const waveRadius = scale;
			for (let i = asteroids.length - 1; i >= 0; i--) {
				const asteroid = asteroids[i];
				const distance = shipGroup.position.distanceTo(
					asteroid.position
				);

				if (distance < waveRadius) {
					// Destroy asteroid with effect
					createExplosion(
						asteroid.position.clone(),
						0x00ffff,
						asteroid.scale.x
					);
					releaseAsteroid(asteroid);
					asteroids.splice(i, 1);

					// Add small score bonus
					score += 25;
					document.getElementById("score").textContent = score;
				}
			}

			requestAnimationFrame(animateWave);
		} else {
			scene.remove(wave);
			disposeObject3D(wave);
			// Create new asteroids to replace destroyed ones
			const targetAsteroids = getTargetAsteroidCount();
			while (asteroids.length < targetAsteroids) {
				createAsteroid();
			}
		}
	}

	animateWave();
}

createTutorialUI({
	isGameActive: () => gameActive,
	isGameOver: () => gameOver,
	pauseGame: () => pauseGame({ showMenu: false, message: null }),
	resumeGame: resumeGame,
});

// Extra feature: music toggle button
const musicButton = document.createElement("button");
musicButton.textContent = "🔇";
musicButton.style.cssText = `
                position: absolute;
                top: 70px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: rgba(0, 150, 255, 0.7);
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 18px;
                cursor: pointer;
                box-shadow: 0 0 15px rgba(0, 150, 255, 0.5);
            `;

let musicPlaying = false;
musicButton.addEventListener("click", () => {
	if (!musicPlaying) {
		musicButton.textContent = "🔊";
		musicPlaying = true;
		showNotification("Music would play now (if implemented)");
	} else {
		musicButton.textContent = "🔇";
		musicPlaying = false;
		showNotification("Music stopped");
	}
});

initializeCustomizationState();
loadShipCustomizations();
document.body.appendChild(musicButton);
document.addEventListener("DOMContentLoaded", () => {
	initShipCustomization();
	initLevelSelect();
	renderLeaderboard();
});
