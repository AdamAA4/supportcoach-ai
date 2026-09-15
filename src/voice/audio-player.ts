type QueuedAudio = { audio: ArrayBuffer; onEnded?: () => void; resolve: () => void; reject: (error: unknown) => void };

export class AudioPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private queue: QueuedAudio[] = [];
  private decoding?: QueuedAudio;
  private generation = 0;

  async play(audio: ArrayBuffer, onEnded?: () => void): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) { onEnded?.(); return; }
    this.context ??= new AudioContext();
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ audio, onEnded, resolve, reject });
      void this.playNext();
    });
  }

  private async playNext(): Promise<void> {
    if (this.source || this.decoding || !this.context) return;
    const item = this.queue.shift();
    if (!item) return;
    const generation = this.generation;
    this.decoding = item;
    try {
      const decoded = await this.context.decodeAudioData(item.audio.slice(0));
      if (generation !== this.generation) return;
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
    this.decoding?.resolve();
    this.decoding = undefined;
    for (const item of this.queue) item.resolve();
    this.queue = [];
    const source = this.source;
    this.source = undefined;
    if (!source) return;
    source.onended = null;
    try { source.stop(); } finally { source.disconnect(); }
  }
}
