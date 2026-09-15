export class AudioPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;

  async play(audio: ArrayBuffer): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    this.stop();
    this.context ??= new AudioContext();
    const decoded = await this.context.decodeAudioData(audio.slice(0));
    const source = this.context.createBufferSource();
    source.buffer = decoded;
    source.connect(this.context.destination);
    source.onended = () => { if (this.source === source) this.source = undefined; };
    this.source = source;
    source.start();
  }

  async playFixture(url: string): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Customer audio fixture could not be loaded.");
    await this.play(await response.arrayBuffer());
  }

  stop(): void {
    if (!this.source) return;
    this.source.stop();
    this.source.disconnect();
    this.source = undefined;
  }
}
