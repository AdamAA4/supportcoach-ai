class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = (options.processorOptions?.inputSampleRate ?? sampleRate) / 24000;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const length = Math.max(1, Math.floor(input.length / this.ratio));
    const pcm = new Int16Array(length);
    for (let index = 0; index < length; index += 1) {
      const sample = input[Math.min(input.length - 1, Math.floor(index * this.ratio))] ?? 0;
      pcm[index] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor("supportcoach-pcm-capture", PcmCaptureProcessor);
