type QueuedAudio = { audio: ArrayBuffer; onEnded?: () => void; resolve: () => void; reject: (error: unknown) => void };

export class AudioPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private readonly scheduledSources = new Set<AudioBufferSourceNode>();
  private queue: QueuedAudio[] = [];
  private decoding?: QueuedAudio;
  private generation = 0;
  private playbackTime = 0;

  async prepare(): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    const chromium = /(?:Chrome|Chromium|EdgA|Brave)\//.test(navigator.userAgent) && !/CriOS\//.test(navigator.userAgent);
    this.context ??= chromium ? new AudioContext({ sampleRate: 24_000 }) : new AudioContext();
    if (this.context.state !== "running" && typeof this.context.resume === "function") await this.context.resume();
    this.playbackTime = Math.max(this.playbackTime, this.context.currentTime ?? 0);
  }

  async play(audio: ArrayBuffer, onEnded?: () => void): Promise<void> {
    const generation = this.generation;
    await this.prepare();
    if (generation !== this.generation) return;
    if (!this.context) { onEnded?.(); return; }
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ audio, onEnded, resolve, reject });
      void this.playNext();
    });
  }

  async playPcm16(audio: ArrayBuffer): Promise<void> {
    const generation = this.generation;
    await this.prepare();
    if (generation !== this.generation) return;
    if (!this.context || audio.byteLength < 2) return;
    const pcm = new Int16Array(audio.slice(0));
    const samples = new Float32Array(pcm.length);
    for (let index = 0; index < pcm.length; index += 1) samples[index] = pcm[index] / 0x8000;
    const buffer = this.context.createBuffer(1, samples.length, 24_000);
    buffer.getChannelData(0).set(samples);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => { this.scheduledSources.delete(source); source.disconnect(); };
    const startAt = Math.max(this.playbackTime, this.context.currentTime);
    source.start(startAt);
    this.playbackTime = startAt + buffer.duration;
    this.scheduledSources.add(source);
  }

  private async playNext(): Promise<void> {
    if (this.source || this.decoding || !this.context) return;
    const item = this.queue.shift();
    if (!item) return;
    const generation = this.generation;
    this.decoding = item;
    try {
      const decoded = await this.context.decodeAudioData(item.audio.slice(0));
      if (generation !== this.generation) { item.resolve(); return; }
      const source = this.context.createBufferSource();
      source.buffer = decoded;
      source.connect(this.context.destination);
      source.onended = () => {
        if (generation !== this.generation || this.source !== source) return;
        this.source = undefined;
        source.disconnect();
        item.onEnded?.();
        void this.playNext();
      };
      this.source = source;
      this.decoding = undefined;
      source.start();
      item.resolve();
    } catch (error) {
      if (generation !== this.generation) return;
      this.decoding = undefined;
      this.source?.disconnect();
      this.source = undefined;
      item.reject(error);
      void this.playNext();
    }
  }

  async playFixture(url: string, onEnded?: () => void): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    const generation = this.generation;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Customer audio fixture could not be loaded.");
    const audio = await response.arrayBuffer();
    if (generation === this.generation) await this.play(audio, onEnded);
  }

  stop(): void {
    this.generation += 1;
    this.playbackTime = this.context?.currentTime ?? 0;
    this.decoding?.resolve();
    this.decoding = undefined;
    for (const item of this.queue) item.resolve();
    this.queue = [];
    const source = this.source;
    this.source = undefined;
    if (source) {
      source.onended = null;
      try { source.stop(); } finally { source.disconnect(); }
    }
    for (const scheduled of this.scheduledSources) {
      scheduled.onended = null;
      try { scheduled.stop(); } finally { scheduled.disconnect(); }
    }
    this.scheduledSources.clear();
  }
}
