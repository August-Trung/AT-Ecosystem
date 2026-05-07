// src/shipCustomization.js
export const shipCustomizations = {
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
			unlocked: true,
		},
		{
			name: "Golden Phoenix",
			primary: 0xffcc00,
			secondary: 0xcc9900,
			unlocked: true,
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
			unlocked: true,
		},
		{
			name: "Dagger",
			scale: { x: 0.8, y: 1.8 },
			geometry: "BoxGeometry",
			unlocked: true,
		},
	],
	engineEffects: [
		{ name: "Blue Flame", color: 0x00ffff, intensity: 1.0, unlocked: true },
		{
			name: "Plasma Burn",
			color: 0xff00ff,
			intensity: 1.2,
			unlocked: true,
		},
		{
			name: "Solar Flare",
			color: 0xffaa00,
			intensity: 1.5,
			unlocked: true,
		},
	],
};
