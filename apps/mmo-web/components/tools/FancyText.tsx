// More complex / fun transforms
const toSuperscript = (str: string) => {
	const map: Record<string, string> = {
		0: "⁰",
		1: "¹",
		2: "²",
		3: "³",
		4: "⁴",
		5: "⁵",
		6: "⁶",
		7: "⁷",
		8: "⁸",
		9: "⁹",
		a: "ᵃ",
		b: "ᵇ",
		c: "ᶜ",
		d: "ᵈ",
		e: "ᵉ",
		f: "ᶠ",
		g: "ᵍ",
		h: "ʰ",
		i: "ᶦ",
		j: "ʲ",
		k: "ᵏ",
		l: "ˡ",
		m: "ᵐ",
		n: "ⁿ",
		o: "ᵒ",
		p: "ᵖ",
		r: "ʳ",
		s: "ˢ",
		t: "ᵗ",
		u: "ᵘ",
		v: "ᵛ",
		w: "ʷ",
		x: "ˣ",
		y: "ʸ",
		z: "ᶻ",
	};
	return Array.from(str)
		.map((c) => map[c.toLowerCase()] || c)
		.join("");
};

const toSubscript = (str: string) => {
	const map: Record<string, string> = {
		0: "₀",
		1: "₁",
		2: "₂",
		3: "₃",
		4: "₄",
		5: "₅",
		6: "₆",
		7: "₇",
		8: "₈",
		9: "₉",
		a: "ₐ",
		e: "ₑ",
		h: "ₕ",
		i: "ᵢ",
		j: "ⱼ",
		k: "ₖ",
		l: "ₗ",
		m: "ₘ",
		n: "ₙ",
		o: "ₒ",
		p: "ₚ",
		r: "ᵣ",
		s: "ₛ",
		t: "ₜ",
		u: "ᵤ",
		v: "ᵥ",
		x: "ₓ",
	};
	return Array.from(str)
		.map((c) => map[c.toLowerCase()] || c)
		.join("");
};

const parenthesized = (str: string) =>
	Array.from(str)
		.map((c) => `(${c})`)
		.join("");

const starred = (str: string) => `★ ${str} ★`;

const emojiPrefix = (str: string) => `🛠️ ${str}`;

const vertical = (str: string) => Array.from(str).join("\n");

const invertCase = (str: string) =>
	Array.from(str)
		.map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
		.join("");

const consonantless = (str: string) => str.replace(/[^aeiouAEIOU\s]/g, "");

const reverseWords = (str: string) => str.split(/\s+/).reverse().join(" ");

const initials = (str: string) =>
	str
		.split(/\s+/)
		.map((w) => (w ? w[0].toUpperCase() : ""))
		.join("");

const rot47 = (str: string) =>
	Array.from(str)
		.map((c) => {
			const code = c.charCodeAt(0);
			if (code >= 33 && code <= 126)
				return String.fromCharCode(33 + ((code + 14) % 94));
			return c;
		})
		.join("");

const hexEscape = (str: string) =>
	Array.from(str)
		.map((c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
		.join("");

const unicodePoints = (str: string) =>
	Array.from(str)
		.map((c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase()}`)
		.join(" ");

const percentEncode = (str: string) => encodeURIComponent(str);

const htmlEntities = (str: string) =>
	Array.from(str)
		.map((c) => `&#${c.charCodeAt(0)};`)
		.join("");

const macronOver = (str: string) =>
	Array.from(str)
		.map((c) => c + "\u0304")
		.join("");

const dotted = (str: string) => Array.from(str).join(".");

const accentedVowels = (str: string) =>
	str.replace(/[aeiouAEIOU]/g, (c) => c + "\u0301");

const wrapAngle = (str: string) => `❮${str}❯`;

const wrapSquare = (str: string) => `【${str}】`;
import React, { useState, useEffect } from "react";
import { Sparkles, Copy, Check } from "lucide-react";

const FancyText = () => {
	const [input, setInput] = useState("AT Tools");
	const [styles, setStyles] = useState<{ name: string; text: string }[]>([]);
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

	// Character Maps
	const FONTS: any = {
		bold: "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗",
		script: "𝓐𝓑𝓒𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃0123456789",
		fraktur:
			"𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷0123456789",
		double: "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡",
		mono: "𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿",
		bubbles:
			"ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ0①②③④⑤⑥⑦⑧⑨",
	};
	const NORMAL =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	const convert = (str: string, fontKey: string) => {
		return str
			.split("")
			.map((char) => {
				const idx = NORMAL.indexOf(char);
				return idx !== -1
					? FONTS[fontKey][idx * 2] +
							(FONTS[fontKey][idx * 2 + 1] || "")
					: char;
				// Note: Some fonts use surrogate pairs (2 chars), handled roughly here by direct indexing if simpler,
				// but JS strings handle surrogate pairs as 2 units length.
				// Let's use Array.from to handle unicode properly
			})
			.join("");
	};

	// Better conversion logic handling unicode characters
	const safeConvert = (str: string, targetMap: string) => {
		const source = Array.from(NORMAL);
		const target = Array.from(targetMap);
		return Array.from(str)
			.map((char) => {
				const i = source.indexOf(char);
				return i !== -1 ? target[i] : char;
			})
			.join("");
	};

	// Zalgo / Glitch
	const zalgo = (str: string) => {
		const chars = [
			"\u0300",
			"\u0301",
			"\u0302",
			"\u0303",
			"\u0304",
			"\u0305",
			"\u0306",
			"\u0307",
			"\u0308",
			"\u0309",
			"\u030A",
			"\u030B",
			"\u030C",
			"\u030D",
			"\u030E",
			"\u030F",
		];
		return Array.from(str)
			.map(
				(c) =>
					c +
					chars[Math.floor(Math.random() * chars.length)] +
					chars[Math.floor(Math.random() * chars.length)]
			)
			.join("");
	};

	// Additional transforms
	const toFullwidth = (str: string) =>
		Array.from(str)
			.map((ch) => {
				const code = ch.charCodeAt(0);
				if (code >= 33 && code <= 126)
					return String.fromCharCode(0xff00 + code - 0x20);
				return ch;
			})
			.join("");

	const toCircled = (str: string) =>
		Array.from(str)
			.map((ch) => {
				if (/[A-Z]/.test(ch))
					return String.fromCharCode(
						0x24b6 + (ch.charCodeAt(0) - 65)
					);
				if (/[a-z]/.test(ch))
					return String.fromCharCode(
						0x24d0 + (ch.charCodeAt(0) - 97)
					);
				if (/[0-9]/.test(ch)) {
					const nums: Record<string, string> = {
						"0": "⓪",
						"1": "①",
						"2": "②",
						"3": "③",
						"4": "④",
						"5": "⑤",
						"6": "⑥",
						"7": "⑦",
						"8": "⑧",
						"9": "⑨",
					};
					return nums[ch] || ch;
				}
				return ch;
			})
			.join("");

	const toLeet = (str: string) =>
		str.replace(/[AaEeIiOoSsLlTt]/g, (c) => {
			const m: Record<string, string> = {
				A: "4",
				a: "4",
				E: "3",
				e: "3",
				I: "1",
				i: "1",
				O: "0",
				o: "0",
				S: "5",
				s: "5",
				L: "1",
				l: "1",
				T: "7",
				t: "7",
			};
			return m[c] || c;
		});

	const alternatingCase = (str: string) =>
		Array.from(str)
			.map((c, i) =>
				/[a-zA-Z]/.test(c)
					? i % 2 === 0
						? c.toUpperCase()
						: c.toLowerCase()
					: c
			)
			.join("");

	const vowelless = (str: string) => str.replace(/[aeiouAEIOU]/g, "");

	const upsideDown = (str: string) => {
		const map: Record<string, string> = {
			a: "ɐ",
			b: "q",
			c: "ɔ",
			d: "p",
			e: "ǝ",
			f: "ɟ",
			g: "ɓ",
			h: "ɥ",
			i: "ᴉ",
			j: "ɾ",
			k: "ʞ",
			l: "l",
			m: "ɯ",
			n: "u",
			o: "o",
			p: "d",
			q: "b",
			r: "ɹ",
			s: "s",
			t: "ʇ",
			u: "n",
			v: "ʌ",
			w: "ʍ",
			x: "x",
			y: "ʎ",
			z: "z",
			A: "∀",
			B: "𐐒",
			C: "Ɔ",
			D: "◖",
			E: "Ǝ",
			F: "Ⅎ",
			G: "⅁",
			H: "H",
			I: "I",
			J: "ſ",
			K: "K",
			L: "˥",
			M: "W",
			N: "N",
			O: "O",
			P: "Ԁ",
			Q: "Q",
			R: "R",
			S: "S",
			T: "┴",
			U: "∩",
			V: "Λ",
			W: "M",
			X: "X",
			Y: "⅄",
			Z: "Z",
			"0": "0",
			"1": "Ɩ",
			"2": "ᄅ",
			"3": "Ɛ",
			"4": "ㄣ",
			"5": "ϛ",
			"6": "9",
			"7": "ㄥ",
			"8": "8",
			"9": "6",
			",": "'",
			".": "˙",
			"?": "¿",
			"!": "¡",
			'"': ",,",
			"'": ",",
			"(": ")",
			")": "(",
			"[": "]",
			"]": "[",
			"{": "}",
			"}": "{",
			"<": ">",
			">": "<",
		};
		return Array.from(str)
			.reverse()
			.map((c) => map[c] || map[c.toLowerCase()] || c)
			.join("");
	};

	const toSmallCaps = (str: string) => {
		const small = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ";
		return Array.from(str)
			.map((c) => {
				const lower = c.toLowerCase();
				if (/[a-z]/.test(lower))
					return small.charAt(lower.charCodeAt(0) - 97);
				return c;
			})
			.join("");
	};

	// More transforms
	const rot13 = (str: string) =>
		str.replace(/[A-Za-z]/g, (c) =>
			String.fromCharCode(
				(c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26
			)
		);

	const toBinary = (str: string) =>
		Array.from(str)
			.map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
			.join(" ");

	const toHex = (str: string) =>
		Array.from(str)
			.map((c) =>
				c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")
			)
			.join(" ");

	const toBase64 = (str: string) => {
		try {
			return btoa(unescape(encodeURIComponent(str)));
		} catch (e) {
			return "";
		}
	};

	const toMorse = (str: string) => {
		const map: Record<string, string> = {
			a: ".-",
			b: "-...",
			c: "-.-.",
			d: "-..",
			e: ".",
			f: "..-.",
			g: "--.",
			h: "....",
			i: "..",
			j: ".---",
			k: "-.-",
			l: ".-..",
			m: "--",
			n: "-.",
			o: "---",
			p: ".--.",
			q: "--.-",
			r: ".-.",
			s: "...",
			t: "-",
			u: "..-",
			v: "...-",
			w: ".--",
			x: "-..-",
			y: "-.--",
			z: "--..",
			"0": "-----",
			"1": ".----",
			"2": "..---",
			"3": "...--",
			"4": "....-",
			"5": ".....",
			"6": "-....",
			"7": "--...",
			"8": "---..",
			"9": "----.",
		};
		return Array.from(str)
			.map((c) => (c === " " ? "/" : map[c.toLowerCase()] || c))
			.join(" ");
	};

	const toSnake = (str: string) =>
		str
			.trim()
			.replace(/[^A-Za-z0-9]+/g, " ")
			.split(/\s+/)
			.map((w) => w.toLowerCase())
			.join("_");

	const toKebab = (str: string) =>
		str
			.trim()
			.replace(/[^A-Za-z0-9]+/g, " ")
			.split(/\s+/)
			.map((w) => w.toLowerCase())
			.join("-");

	const toCamel = (str: string) => {
		const parts = str
			.trim()
			.replace(/[^A-Za-z0-9]+/g, " ")
			.split(/\s+/)
			.map((w) => w.toLowerCase());
		return parts
			.map((p, i) =>
				i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)
			)
			.join("");
	};

	const toTitle = (str: string) =>
		str
			.toLowerCase()
			.split(/\s+/)
			.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
			.join(" ");

	const regionalIndicators = (str: string) =>
		Array.from(str)
			.map((c) => {
				if (/[A-Za-z]/.test(c)) {
					const base = 0x1f1e6;
					const code = base + c.toUpperCase().charCodeAt(0) - 65;
					return String.fromCodePoint(code);
				}
				return c;
			})
			.join("");

	const bracketed = (str: string) => `『${str}』`;

	const dotted = (str: string) => Array.from(str).join("·");

	const repeatChars = (str: string) =>
		Array.from(str)
			.map((c) => c + c)
			.join("");

	useEffect(() => {
		const s = [
			{ name: "Bold Serif", text: safeConvert(input, FONTS.bold) },
			{ name: "Double Struck", text: safeConvert(input, FONTS.double) },
			{ name: "Script", text: safeConvert(input, FONTS.script) },
			{ name: "Fraktur", text: safeConvert(input, FONTS.fraktur) },
			{ name: "Monospace", text: safeConvert(input, FONTS.mono) },
			{ name: "Bubbles", text: safeConvert(input, FONTS.bubbles) },
			{ name: "Glitch / Zalgo", text: zalgo(input) },
			{ name: "Reverse", text: input.split("").reverse().join("") },
			{ name: "Spaced", text: input.split("").join(" ") },
			{ name: "Fullwidth", text: toFullwidth(input) },
			{ name: "Circled", text: toCircled(input) },
			{ name: "Leet", text: toLeet(input) },
			{ name: "Alternating Case", text: alternatingCase(input) },
			{ name: "Vowelless", text: vowelless(input) },
			{ name: "Upside Down", text: upsideDown(input) },
			{ name: "Small Caps", text: toSmallCaps(input) },
			{ name: "ROT13", text: rot13(input) },
			{ name: "Binary (8-bit)", text: toBinary(input) },
			{ name: "Hex (bytes)", text: toHex(input) },
			{ name: "Base64", text: toBase64(input) },
			{ name: "Morse", text: toMorse(input) },
			{ name: "snake_case", text: toSnake(input) },
			{ name: "kebab-case", text: toKebab(input) },
			{ name: "camelCase", text: toCamel(input) },
			{ name: "Title Case", text: toTitle(input) },
			{ name: "Regional Indicators", text: regionalIndicators(input) },
			{ name: "Bracketed", text: bracketed(input) },
			{ name: "Dotted", text: dotted(input) },
			{ name: "Repeat Chars", text: repeatChars(input) },
			{ name: "Superscript", text: toSuperscript(input) },
			{ name: "Subscript", text: toSubscript(input) },
			{ name: "Parenthesized", text: parenthesized(input) },
			{ name: "Starred", text: starred(input) },
			{ name: "Emoji Prefix", text: emojiPrefix(input) },
			{ name: "Vertical", text: vertical(input) },
			{ name: "Invert Case", text: invertCase(input) },
			{ name: "Consonantless", text: consonantless(input) },
			{ name: "Reverse Words", text: reverseWords(input) },
			{ name: "Initials", text: initials(input) },
			{ name: "ROT47", text: rot47(input) },
			{ name: "Hex Escaped", text: hexEscape(input) },
			{ name: "Unicode Points", text: unicodePoints(input) },
			{ name: "Percent Encoded", text: percentEncode(input) },
			{ name: "HTML Entities", text: htmlEntities(input) },
			{ name: "Macron Over", text: macronOver(input) },
			{ name: "Dotted Letters", text: dotted(input) },
			{ name: "Accented Vowels", text: accentedVowels(input) },
			{ name: "Angle Wrapped", text: wrapAngle(input) },
			{ name: "Square Wrapped", text: wrapSquare(input) },
			{ name: "ROT13", text: rot13(input) },
			{ name: "Binary (8-bit)", text: toBinary(input) },
			{ name: "Hex (bytes)", text: toHex(input) },
			{ name: "Base64", text: toBase64(input) },
			{ name: "Morse", text: toMorse(input) },
			{ name: "snake_case", text: toSnake(input) },
			{ name: "kebab-case", text: toKebab(input) },
			{ name: "camelCase", text: toCamel(input) },
			{ name: "Title Case", text: toTitle(input) },
			{ name: "Regional Indicators", text: regionalIndicators(input) },
			{ name: "Bracketed", text: bracketed(input) },
			{ name: "Dotted", text: dotted(input) },
			{ name: "Repeat Chars", text: repeatChars(input) },
		];
		setStyles(s);
	}, [input]);

	const copy = (text: string, idx: number) => {
		navigator.clipboard.writeText(text);
		setCopiedIndex(idx);
		setTimeout(() => setCopiedIndex(null), 1000);
	};

	return (
		<div className="max-w-3xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Sparkles className="text-pink-400" /> Fancy Text Generator
			</h2>

			<div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 sticky top-4 z-10 shadow-xl mb-8">
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Type something cool..."
					className="w-full bg-dark-900 border border-dark-600 rounded-xl p-4 text-xl text-white outline-none focus:border-pink-500 transition-colors"
				/>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
				{styles.map((style, idx) => (
					<div
						key={idx}
						onClick={() => copy(style.text, idx)}
						className="bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-pink-500/50 p-4 rounded-xl cursor-pointer group transition-all flex items-center justify-between">
						<div>
							<p className="text-xs text-gray-500 font-bold uppercase mb-1">
								{style.name}
							</p>
							<p className="text-lg md:text-xl text-white break-all font-medium">
								{style.text}
							</p>
						</div>
						<div className="p-2 text-gray-500 group-hover:text-white transition-colors">
							{copiedIndex === idx ? (
								<Check size={20} className="text-green-500" />
							) : (
								<Copy size={20} />
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default FancyText;
