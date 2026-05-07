class SoundManager {
	private ctx: AudioContext | null = null;
	private atmosphereSource: AudioBufferSourceNode | null = null;
	private lofiInterval: any = null;
	private beatInterval: any = null;
	private isLofiPlaying: boolean = false;
	private currentStep: number = 0;

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

	public toggleAtmosphere(mode: "off" | "rain" | "lofi") {
		const ctx = this.init();

		// Stop all current sounds
		if (this.atmosphereSource) {
			try {
				this.atmosphereSource.stop();
			} catch (e) {}
			this.atmosphereSource.disconnect();
			this.atmosphereSource = null;
		}

		if (this.lofiInterval) {
			clearInterval(this.lofiInterval);
			this.lofiInterval = null;
		}
		if (this.beatInterval) {
			clearInterval(this.beatInterval);
			this.beatInterval = null;
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
		filter.frequency.value = mode === "lofi" ? 400 : 700;
		const gain = ctx.createGain();
		gain.gain.value = mode === "lofi" ? 0.015 : 0.04;
		noiseSource.connect(filter);
		filter.connect(gain);
		gain.connect(ctx.destination);
		noiseSource.start();
		this.atmosphereSource = noiseSource;

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
	}
}

export const sound = new SoundManager();
