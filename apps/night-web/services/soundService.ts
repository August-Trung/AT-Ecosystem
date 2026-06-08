class SoundManager {
	private ctx: AudioContext | null = null;
	private atmosphereSource: AudioBufferSourceNode | null = null;
	private lofiInterval: any = null;
	private beatInterval: any = null;
	private isLofiPlaying: boolean = false;
	private currentStep: number = 0;
	private wavesLfo: OscillatorNode | null = null;
	private activeOscillators: OscillatorNode[] = [];
	private jazzInterval: any = null;
	private ambientInterval: any = null;

	private init() {
		if (!this.ctx) {
			this.ctx = new (
				window.AudioContext || (window as any).webkitAudioContext
			)();
		}
		if (this.ctx.state === "suspended") {
			this.ctx.resume();
		}
		return this.ctx;
	}

	public playClick() {
		const ctx = this.init();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "square";
		osc.frequency.setValueAtTime(400, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
		gain.gain.setValueAtTime(0.04, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.1);
	}

	public playMessage() {
		const ctx = this.init();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "triangle";
		osc.frequency.setValueAtTime(523.25, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(
			659.25,
			ctx.currentTime + 0.15,
		);
		gain.gain.setValueAtTime(0.06, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.3);
	}

	public playWin() {
		const ctx = this.init();
		const now = ctx.currentTime;
		const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 arpeggio
		notes.forEach((freq, index) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "square";
			osc.frequency.setValueAtTime(freq, now + index * 0.08);
			gain.gain.setValueAtTime(0, now + index * 0.08);
			gain.gain.linearRampToValueAtTime(0.03, now + index * 0.08 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.15);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + index * 0.08);
			osc.stop(now + index * 0.08 + 0.15);
		});
	}

	private playKick() {
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.frequency.setValueAtTime(100, this.ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(
			0.01,
			this.ctx.currentTime + 0.15,
		);
		gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(
			0.001,
			this.ctx.currentTime + 0.15,
		);
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start();
		osc.stop(this.ctx.currentTime + 0.15);
	}

	private playSnare() {
		if (!this.ctx) return;
		const bufferSize = this.ctx.sampleRate * 0.1;
		const buffer = this.ctx.createBuffer(
			1,
			bufferSize,
			this.ctx.sampleRate,
		);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		const filter = this.ctx.createBiquadFilter();
		filter.type = "highpass";
		filter.frequency.value = 800;
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(
			0.001,
			this.ctx.currentTime + 0.1,
		);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(this.ctx.destination);
		source.start();
	}

	private playBass(freq: number) {
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(freq / 2, this.ctx.currentTime);
		gain.gain.setValueAtTime(0, this.ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.1);
		gain.gain.exponentialRampToValueAtTime(
			0.001,
			this.ctx.currentTime + 1.2,
		);
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start();
		osc.stop(this.ctx.currentTime + 1.2);
	}

	private playLofiNote() {
		if (!this.isLofiPlaying || !this.ctx) return;
		const notes = [164.81, 207.65, 246.94, 329.63, 415.3];
		const freq = notes[Math.floor(Math.random() * notes.length)];
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const filter = this.ctx.createBiquadFilter();
		osc.type = "triangle";
		osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
		filter.type = "lowpass";
		filter.frequency.setValueAtTime(600, this.ctx.currentTime);
		gain.gain.setValueAtTime(0, this.ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.025, this.ctx.currentTime + 0.6);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 5);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start();
		osc.stop(this.ctx.currentTime + 5);
	}

	private playVinylCrackle() {
		if (!this.isLofiPlaying || !this.ctx) return;
		if (Math.random() > 0.05) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "square";
		osc.frequency.setValueAtTime(
			Math.random() * 1000 + 500,
			this.ctx.currentTime,
		);
		gain.gain.setValueAtTime(0.005, this.ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.01);
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start();
		osc.stop(this.ctx.currentTime + 0.01);
	}

	private playJazzChord(frequencies: number[]) {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		frequencies.forEach((freq) => {
			const osc = this.ctx!.createOscillator();
			const gain = this.ctx!.createGain();
			const filter = this.ctx!.createBiquadFilter();

			osc.type = "triangle";
			osc.frequency.setValueAtTime(freq, now);

			filter.type = "lowpass";
			filter.frequency.setValueAtTime(450, now);

			// Warm electric piano envelope: slow attack, long release
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(0.014, now + 0.8);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);

			osc.connect(filter);
			filter.connect(gain);
			gain.connect(this.ctx!.destination);

			osc.start(now);
			osc.stop(now + 4.5);

			this.activeOscillators.push(osc);
		});
	}

	private playCampfirePop() {
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const filter = this.ctx.createBiquadFilter();
		osc.type = "square";
		osc.frequency.setValueAtTime(Math.random() * 800 + 400, this.ctx.currentTime);
		filter.type = "highpass";
		filter.frequency.value = 1000;
		gain.gain.setValueAtTime(0.012, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.015);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start();
		osc.stop(this.ctx.currentTime + 0.015);
	}

	private playCafeClink() {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(1400 + Math.random() * 1200, now);
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.006, now + 0.002);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start(now);
		osc.stop(now + 0.12);
	}

	public toggleAtmosphere(mode: "off" | "rain" | "lofi" | "waves" | "jazz" | "campfire" | "cafe") {
		const ctx = this.init();

		// Stop all current sounds
		if (this.atmosphereSource) {
			try {
				this.atmosphereSource.stop();
			} catch (e) {}
			this.atmosphereSource.disconnect();
			this.atmosphereSource = null;
		}

		if (this.wavesLfo) {
			try {
				this.wavesLfo.stop();
			} catch (e) {}
			this.wavesLfo.disconnect();
			this.wavesLfo = null;
		}

		this.activeOscillators.forEach((osc) => {
			try {
				osc.stop();
			} catch (e) {}
			osc.disconnect();
		});
		this.activeOscillators = [];

		if (this.lofiInterval) {
			clearInterval(this.lofiInterval);
			this.lofiInterval = null;
		}
		if (this.beatInterval) {
			clearInterval(this.beatInterval);
			this.beatInterval = null;
		}
		if (this.jazzInterval) {
			clearInterval(this.jazzInterval);
			this.jazzInterval = null;
		}
		if (this.ambientInterval) {
			clearInterval(this.ambientInterval);
			this.ambientInterval = null;
		}

		this.isLofiPlaying = false;
		this.currentStep = 0;

		if (mode === "off") return;

		// Background noise
		const bufferSize = 2 * ctx.sampleRate;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const output = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

		const noiseSource = ctx.createBufferSource();
		noiseSource.buffer = buffer;
		noiseSource.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = mode === "lofi" ? 400 : mode === "rain" ? 700 : mode === "waves" ? 450 : mode === "campfire" ? 220 : mode === "cafe" ? 500 : 350;
		const gain = ctx.createGain();
		gain.gain.value = mode === "lofi" ? 0.015 : mode === "rain" ? 0.04 : mode === "waves" ? 0.02 : mode === "campfire" ? 0.025 : mode === "cafe" ? 0.016 : 0.012;
		noiseSource.connect(filter);
		filter.connect(gain);
		gain.connect(ctx.destination);
		noiseSource.start();
		this.atmosphereSource = noiseSource;

		if (mode === "waves") {
			// Create LFO to modulate volume and filter frequency
			const lfo = ctx.createOscillator();
			lfo.type = "sine";
			lfo.frequency.value = 0.07; // ~14s cycle

			const lfoGain = ctx.createGain();
			lfoGain.gain.value = 0.018; // oscillate between 0.002 and 0.038

			const lfoFilterGain = ctx.createGain();
			lfoFilterGain.gain.value = 250; // oscillate filter between 200 Hz and 700 Hz

			lfo.connect(lfoGain);
			lfoGain.connect(gain.gain);

			lfo.connect(lfoFilterGain);
			lfoFilterGain.connect(filter.frequency);

			lfo.start();
			this.wavesLfo = lfo;
		}

		if (mode === "lofi") {
			this.isLofiPlaying = true;

			this.lofiInterval = setInterval(() => {
				if (Math.random() > 0.4) this.playLofiNote();
				this.playVinylCrackle();
			}, 1000);

			const stepTime = 400; // ~75 BPM
			const bassNotes = [164.81, 246.94, 207.65];

			this.beatInterval = setInterval(() => {
				if (this.currentStep % 8 === 0) this.playKick();
				if (this.currentStep % 8 === 4) this.playSnare();
				if (this.currentStep % 16 === 0) {
					const bNote =
						bassNotes[
							Math.floor(this.currentStep / 16) % bassNotes.length
						];
					this.playBass(bNote);
				}
				this.currentStep = (this.currentStep + 1) % 32;
			}, stepTime);
		}

		if (mode === "jazz") {
			this.isLofiPlaying = true;
			this.lofiInterval = setInterval(() => {
				this.playVinylCrackle();
			}, 1000);

			const progressions = [
				[130.81, 196.00, 246.94, 329.63], // Cmaj7 (C3, G3, B3, E4)
				[146.83, 220.00, 261.63, 349.23], // Dm7 (D3, A3, C4, F4)
				[110.00, 196.00, 261.63, 329.63], // Am7 (A2, G3, C4, E4)
				[98.00, 174.61, 246.94, 293.66],  // G7 (G2, F3, B3, D4)
			];
			let progressionIndex = 0;

			this.playJazzChord(progressions[progressionIndex]);
			progressionIndex = (progressionIndex + 1) % progressions.length;

			this.jazzInterval = setInterval(() => {
				this.playJazzChord(progressions[progressionIndex]);
				progressionIndex = (progressionIndex + 1) % progressions.length;
			}, 4800);
		}

		if (mode === "campfire") {
			this.ambientInterval = setInterval(() => {
				if (Math.random() > 0.3) {
					this.playCampfirePop();
				}
			}, 250);
		}

		if (mode === "cafe") {
			this.ambientInterval = setInterval(() => {
				if (Math.random() > 0.7) {
					this.playCafeClink();
				}
			}, 1500);
		}
	}
}

export const sound = new SoundManager();
