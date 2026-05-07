import { heroui } from "@heroui/theme";
export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
		"./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
	],
	darkMode: ["class"],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			fontFamily: {
				playfair: ['"Playfair Display"', "serif"],
				roboto: ["Roboto", "sans-serif"],
			},
			borderColor: {
				border: "hsl(var(--border))",
			},
			colors: {
				pastelPink: "#FCE4EC",
				pastelHeart: "#FFB6C1",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground":
						"hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground":
						"hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			keyframes: {
				heartbeat: {
					// chuyển thành lowercase
					"0%,100%": { transform: "scale(1)" },
					"14%": { transform: "scale(1.13)" },
					"28%": { transform: "scale(0.95)" },
					"42%": { transform: "scale(1.06)" },
					"70%": { transform: "scale(1)" },
				},
				float: {
					"0%": { transform: "translateY(0)" },
					"100%": { transform: "translateY(-30px)" },
				},
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				fade: {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				scale: {
					"0%": { transform: "scale(0)" },
					"100%": { transform: "scale(1)" },
				},
				floatupanddown: {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-6px)" },
				},
			},
			animation: {
				heartbeat: "heartbeat 1.6s infinite",
				float: "float 4s ease-in-out infinite alternate",
				floatupanddown: "floatupanddown 3s ease-in-out infinite",
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				fade: "fade 0.3s ease-in-out",
				scale: "scale 0.3s ease-in-out",
			},
		},
	},
	plugins: [heroui()],
};
