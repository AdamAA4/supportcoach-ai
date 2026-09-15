import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "./audio-player";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("AudioPlayer chunk lifecycle", () => {
  const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = [];
  const decode = vi.fn();
  beforeEach(() => {
    sources.length = 0;
    decode.mockReset().mockResolvedValue({});
    class Context {
      destination = {};
      decodeAudioData = decode;
      createBufferSource() {
        const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), onended: null, buffer: null };
        sources.push(source);
        return source;
      }
    }
    vi.stubGlobal("AudioContext", Context);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("plays consecutive chunks in order without cutting off the current chunk", async () => {
    const player = new AudioPlayer();
    const ended = vi.fn();
    await player.play(new ArrayBuffer(2), ended);
    const second = player.play(new ArrayBuffer(4));
    await Promise.resolve();
    expect(sources[0].stop).not.toHaveBeenCalled();
    expect(sources).toHaveLength(1);
    sources[0].onended?.();
    await second;
    expect(ended).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(2);
    expect(sources[1].start).toHaveBeenCalledTimes(1);
  });

  it("stop cancels decoding and queued chunks, including their callbacks", async () => {
    const pending = deferred<AudioBuffer>();
    decode.mockReturnValueOnce(pending.promise);
    const player = new AudioPlayer();
    const ended = vi.fn();
    const first = player.play(new ArrayBuffer(2), ended);
    const queued = player.play(new ArrayBuffer(4), ended);
    player.stop();
    pending.resolve({} as AudioBuffer);
    await Promise.all([first, queued]);
    expect(sources).toHaveLength(0);
    expect(ended).not.toHaveBeenCalled();
    await player.play(new ArrayBuffer(6));
    expect(sources).toHaveLength(1);
  });

  it("stop disconnects active playback once and ignores late completion", async () => {
    const player = new AudioPlayer();
    const ended = vi.fn();
    await player.play(new ArrayBuffer(2), ended);
    const lateEnded = sources[0].onended;
    const queued = player.play(new ArrayBuffer(4));
    player.stop();
    player.stop();
    lateEnded?.();
    await queued;
    expect(sources[0].stop).toHaveBeenCalledTimes(1);
    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(ended).not.toHaveBeenCalled();
    expect(sources).toHaveLength(1);
  });
});
