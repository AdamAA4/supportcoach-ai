"use client";

import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PracticeContext } from "../domain/validation";
import type { TranscriptTurn } from "../domain/transcript";
import { AudioPlayer } from "../voice/audio-player";
import { AssemblyAiVoiceAgent, createConfiguredVoiceAgent } from "../voice/assemblyai-voice-agent";
import { reduceCallState, type CallState, type VoiceAgent, type VoiceAgentEvent } from "../voice/voice-agent";
import { ReferencePanel } from "./reference-panel";
import { TranscriptPane } from "./transcript-pane";
import { BackLink, btnDanger, btnPrimary, btnSecondary, displayTitle, EndCallIcon, MicIcon, MicOffIcon, StatusLamp, type LampTone } from "./ui";

type CallConsoleProps = { context: PracticeContext; createAgent?: () => VoiceAgent; onCallEnded?: (transcript: TranscriptTurn[]) => void };
type MicrophoneStatus = "not-started" | "recording" | "muted";
type MuteableVoiceAgent = VoiceAgent & { setMuted?: (muted: boolean) => Promise<void> };
type FixturePlaybackAwareVoiceAgent = VoiceAgent & { completeCustomerAudioPlayback?: () => void; getCustomerAudioAvailability?: () => "available" | "text-only" };

const now = () => new Date().toISOString();
const transcriptTurn = (speaker: TranscriptTurn["speaker"], text: string, source: TranscriptTurn["source"]): TranscriptTurn => ({ id: `${speaker}-${crypto.randomUUID()}`, speaker, text, source, startedAt: now(), endedAt: now() });
const createConfiguredAgent = (): VoiceAgent => createConfiguredVoiceAgent();

const callStateTone = (state: CallState): LampTone =>
  state === "error" ? "danger" : state === "idle" || state === "ended" ? "neutral" : "ok";
const callStateLive = (state: CallState): boolean => state !== "idle" && state !== "ended" && state !== "error";

export function CallConsole({ context, createAgent = createConfiguredAgent, onCallEnded }: CallConsoleProps) {
  const agent = useRef<VoiceAgent | undefined>(undefined);
  const audio = useRef(new AudioPlayer());
  const microphoneBeforeMute = useRef<MicrophoneStatus>("not-started");
  const microphoneFailed = useRef(false);
  const captureRevision = useRef(0);
  const connectionRevision = useRef(0);
  const ending = useRef(false);
  const finalTurns = useRef<TranscriptTurn[]>([]);
  const [state, setState] = useState<CallState>("idle");
  const [microphone, setMicrophone] = useState<MicrophoneStatus>("not-started");
  const [customerAudioActive, setCustomerAudioActive] = useState(false);
  const [customerAudioAvailability, setCustomerAudioAvailability] = useState<"available" | "text-only">("available");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [partialCustomer, setPartialCustomer] = useState("");
  const [partialTrainee, setPartialTrainee] = useState("");
  const [error, setError] = useState<string>();

  const transition = useCallback((event: Parameters<typeof reduceCallState>[1]) => setState((current) => reduceCallState(current, event)), []);
  const append = useCallback((speaker: TranscriptTurn["speaker"], text: string, source: TranscriptTurn["source"]) => {
    finalTurns.current = [...finalTurns.current, transcriptTurn(speaker, text, source)];
    setTurns(finalTurns.current);
  }, []);

  const handleEvent = useCallback((event: VoiceAgentEvent) => {
    if (event.type === "session-ready") { transition(event); return; }
    if (event.type === "customer-turn-started") { setCustomerAudioActive(true); setCustomerAudioAvailability("available"); transition(event); return; }
    if (event.type === "customer-turn-ended") { setCustomerAudioActive(false); setCustomerAudioAvailability((agent.current as FixturePlaybackAwareVoiceAgent | undefined)?.getCustomerAudioAvailability?.() ?? "available"); transition(event); return; }
    if (event.type === "interrupted") { audio.current.stop(); setCustomerAudioActive(false); transition(event); return; }
    if (event.type === "customer-audio") { const playback = agent.current instanceof AssemblyAiVoiceAgent ? audio.current.playPcm16(event.audio) : audio.current.play(event.audio, () => (agent.current as FixturePlaybackAwareVoiceAgent | undefined)?.completeCustomerAudioPlayback?.()); playback.catch(() => { setError("Customer audio could not play. End the call and try again."); setCustomerAudioActive(false); transition({ type: "error" }); }); return; }
    if (event.type === "customer-transcript") { if (!event.final) { setPartialCustomer(event.text); return; } setPartialCustomer(""); append("customer", event.text, "mock-transcript"); return; }
    if (event.type === "trainee-transcript") { if (!event.final) { setPartialTrainee(event.text); return; } setPartialTrainee(""); append("trainee", event.text, "live-transcript"); transition({ type: "trainee-turn-finalized" }); return; }
    if (event.type === "error") {
      if (event.code === "permission-denied") { microphoneFailed.current = true; captureRevision.current += 1; setMicrophone("not-started"); setError("Microphone permission is required for voice practice. Enable it in your browser settings, then retry the call."); transition({ type: "error" }); void agent.current?.end(); return; }
      captureRevision.current += 1;
      audio.current.stop(); setError(event.message); setCustomerAudioActive(false); setMicrophone("not-started"); transition(event);
    }
  }, [append, transition]);

  const joinVoiceCall = useCallback(async (retry = false) => {
    const revision = ++connectionRevision.current;
    captureRevision.current += 1;
    setError(undefined); setCustomerAudioActive(false); transition({ type: retry ? "retry" : "connect" });
    const previousAgent = agent.current;
    agent.current = undefined;
    if (previousAgent) await previousAgent.end();
    if (revision !== connectionRevision.current) return;
    const nextAgent = createAgent();
    agent.current = nextAgent;
    const handleOwnedEvent = (event: VoiceAgentEvent) => {
      if (revision === connectionRevision.current && agent.current === nextAgent) handleEvent(event);
    };
    try {
      await audio.current.prepare();
      const connection = nextAgent.connect({ scenario: context.scenario, facts: context.facts, onEvent: handleOwnedEvent });
      await nextAgent.startMicrophone();
      if (revision === connectionRevision.current && !microphoneFailed.current) setMicrophone("recording");
      await connection;
    } catch { handleOwnedEvent({ type: "error", code: "network", message: "The practice call could not connect. Try again." }); }
  }, [context.facts, context.scenario, createAgent, handleEvent, transition]);

  useEffect(() => { const player = audio.current; return () => { connectionRevision.current += 1; captureRevision.current += 1; player.stop(); const currentAgent = agent.current; agent.current = undefined; void currentAgent?.end(); }; }, []);
  const mute = async () => {
    if (microphone === "muted") { setMicrophone(microphoneBeforeMute.current); const mutedAgent = agent.current as MuteableVoiceAgent | undefined; if (mutedAgent?.setMuted) await mutedAgent.setMuted(false); else if (microphoneBeforeMute.current === "recording") await agent.current?.startMicrophone(); return; }
    microphoneBeforeMute.current = microphone;
    audio.current.stop(); agent.current?.interruptCustomer(); setCustomerAudioActive(false); setMicrophone("muted"); await (agent.current as MuteableVoiceAgent | undefined)?.setMuted?.(true);
  };
  const end = async () => {
    if (ending.current) return;
    ending.current = true;
    const revision = ++connectionRevision.current;
    captureRevision.current += 1;
    setState("ended"); setError(undefined); setCustomerAudioActive(false); setMicrophone("not-started"); audio.current.stop();
    const currentAgent = agent.current;
    agent.current = undefined;
    const snapshot = finalTurns.current.map((turn) => ({ ...turn }));
    try {
      await currentAgent?.end();
      if (revision === connectionRevision.current) onCallEnded?.(snapshot);
    } catch {
      if (revision === connectionRevision.current) setError("The call could not finish cleanly. Return to source setup to start a new practice call.");
    }
  };
  const displayTurns = [...turns, ...(partialCustomer ? [transcriptTurn("customer", partialCustomer, "mock-transcript")] : []), ...(partialTrainee ? [transcriptTurn("trainee", partialTrainee, "live-transcript")] : [])];
  const callLive = callStateLive(state);
  return (
    <div className="settle-in">
      <header>
        <div className="mb-6">
          <BackLink href="/setup" label="Source setup" />
        </div>
        <h1 className={`${displayTitle} text-3xl leading-[1.1] sm:text-4xl`}>{context.scenario.title}</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">Join the voice call, then answer the AI simulated customer from the confirmed session reference.</p>
      </header>
      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] lg:gap-6">
        <div className="space-y-5">
          <section aria-label="Call controls" className="rounded-2xl bg-shell p-1.5 shadow-card">
            <div className="rounded-xl bg-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <span className="inline-block rounded-full bg-tape px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-tape-ink">{context.sourceLabel}</span>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${state === "error" ? "bg-danger-bg text-danger-ink" : callLive ? "bg-ok-bg text-ok-ink" : "bg-panel-2 text-ink-muted"}`}>
                  <StatusLamp tone={callStateTone(state)} pulse={callLive} />
                  {state.replace("-", " ")}
                </span>
              </div>
              <div className="space-y-2.5 px-5 pb-1 pt-4 sm:px-6">
                <p className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <StatusLamp tone={microphone === "recording" ? "ok" : microphone === "muted" ? "warn" : "neutral"} pulse={microphone === "recording"} />
                  <span>Microphone: {microphone === "recording" ? "On — speak naturally" : microphone === "muted" ? "Muted" : "Not connected"}</span>
                </p>
                <p className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <StatusLamp tone={customerAudioActive ? "ok" : customerAudioAvailability === "text-only" ? "danger" : "warn"} pulse={customerAudioActive} />
                  <span>Customer audio: {customerAudioActive ? "Speaking" : customerAudioAvailability === "text-only" ? "Unavailable" : "Ready"}</span>
                </p>
              </div>
              {error && (
                <div role={state === "error" ? "alert" : "status"} className="mx-5 mt-4 rounded-lg border border-danger/40 bg-danger-bg px-3.5 py-3 text-sm text-danger-ink sm:mx-6">
                  {error}
                  {state === "error" && <button type="button" onClick={() => void joinVoiceCall(true)} className="ml-3 font-bold underline underline-offset-2 transition-opacity duration-150 hover:opacity-80">Retry voice call</button>}
                </div>
              )}
              <div className="flex flex-wrap gap-2.5 px-5 py-5 sm:px-6">
                {state === "idle" && <button type="button" onClick={() => void joinVoiceCall()} className={btnPrimary}><MicIcon className="size-4" />Join voice call</button>}
                {state === "connecting" && <button type="button" disabled className={`${btnPrimary} opacity-70`}><span aria-hidden="true" className="rec-pulse inline-block size-2 rounded-full bg-white/80" />Connecting microphone…</button>}
                {(microphone === "recording" || microphone === "muted") && (
                  <button type="button" onClick={() => void mute()} disabled={state === "ended" || state === "error"} className={btnSecondary}>
                    {microphone === "muted" ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
                    {microphone === "muted" ? "Unmute" : "Mute"}
                  </button>
                )}
                {state !== "idle" && <button type="button" onClick={() => void end()} disabled={state === "ended"} className={btnDanger}><EndCallIcon className="size-4" />End call</button>}
              </div>
            </div>
          </section>
          <TranscriptPane turns={displayTurns} live={callLive} />
        </div>
        <ReferencePanel context={context} />
      </div>
    </div>
  );
}
