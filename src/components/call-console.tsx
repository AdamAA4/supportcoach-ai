"use client";

import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PracticeContext } from "../domain/validation";
import type { TranscriptTurn } from "../domain/transcript";
import { AudioPlayer } from "../voice/audio-player";
import { MockVoiceAgent } from "../voice/mock-voice-agent";
import { reduceCallState, type CallState, type VoiceAgent, type VoiceAgentEvent } from "../voice/voice-agent";
import { ReferencePanel } from "./reference-panel";
import { TranscriptPane } from "./transcript-pane";

type CallConsoleProps = { context: PracticeContext; createAgent?: () => VoiceAgent };
type MicrophoneStatus = "not-started" | "recording" | "typed-fallback" | "muted";
type MockControl = VoiceAgent & { requestMockCustomerTurn?: () => void };
type MuteableVoiceAgent = VoiceAgent & { setMuted?: (muted: boolean) => Promise<void> };
type FixturePlaybackAwareVoiceAgent = VoiceAgent & { completeCustomerAudioPlayback?: () => void; getCustomerAudioAvailability?: () => "available" | "text-only" };

const now = () => new Date().toISOString();
const transcriptTurn = (speaker: TranscriptTurn["speaker"], text: string, source: TranscriptTurn["source"]): TranscriptTurn => ({ id: `${speaker}-${crypto.randomUUID()}`, speaker, text, source, startedAt: now(), endedAt: now() });
const createMockAgent = (): VoiceAgent => new MockVoiceAgent();

export function CallConsole({ context, createAgent = createMockAgent }: CallConsoleProps) {
  const agent = useRef<VoiceAgent | undefined>(undefined);
  const audio = useRef(new AudioPlayer());
  const microphoneBeforeMute = useRef<MicrophoneStatus>("not-started");
  const microphoneFailed = useRef(false);
  const [state, setState] = useState<CallState>("idle");
  const [microphone, setMicrophone] = useState<MicrophoneStatus>("not-started");
  const [customerAudioActive, setCustomerAudioActive] = useState(false);
  const [customerAudioAvailability, setCustomerAudioAvailability] = useState<"available" | "text-only">("available");
  const [typedText, setTypedText] = useState("");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState<string>();

  const transition = useCallback((event: Parameters<typeof reduceCallState>[1]) => setState((current) => reduceCallState(current, event)), []);
  const append = useCallback((speaker: TranscriptTurn["speaker"], text: string, source: TranscriptTurn["source"]) => setTurns((current) => [...current, transcriptTurn(speaker, text, source)]), []);

  const handleEvent = useCallback((event: VoiceAgentEvent) => {
    if (event.type === "session-ready") { transition(event); return; }
    if (event.type === "customer-turn-started") { setCustomerAudioActive(true); setCustomerAudioAvailability("available"); transition(event); return; }
    if (event.type === "customer-turn-ended") { setCustomerAudioActive(false); setCustomerAudioAvailability((agent.current as FixturePlaybackAwareVoiceAgent | undefined)?.getCustomerAudioAvailability?.() ?? "available"); transition(event); return; }
    if (event.type === "interrupted") { audio.current.stop(); setCustomerAudioActive(false); transition(event); return; }
    if (event.type === "customer-audio") { audio.current.play(event.audio, () => (agent.current as FixturePlaybackAwareVoiceAgent | undefined)?.completeCustomerAudioPlayback?.()).catch(() => { setError("Customer audio could not play. Read the transcript or use typed fallback."); setCustomerAudioActive(false); transition({ type: "error" }); }); return; }
    if (event.type === "customer-transcript" && event.final) { append("customer", event.text, "mock-transcript"); return; }
    if (event.type === "trainee-transcript" && event.final) { append("trainee", event.text, "live-transcript"); transition({ type: "trainee-turn-finalized" }); return; }
    if (event.type === "error") {
      if (event.code === "permission-denied") { microphoneFailed.current = true; setMicrophone("typed-fallback"); setError(`${event.message} Typed fallback is active.`); return; }
      setError(event.message); setCustomerAudioActive(false); transition(event);
    }
  }, [append, transition]);

  const connect = useCallback(async (retry = false) => {
    setError(undefined); setCustomerAudioActive(false); transition({ type: retry ? "retry" : "connect" });
    await agent.current?.end();
    const nextAgent = createAgent();
    agent.current = nextAgent;
    try { await nextAgent.connect({ scenario: context.scenario, facts: context.facts, onEvent: handleEvent }); }
    catch { handleEvent({ type: "error", code: "network", message: "The practice call could not connect. Try again." }); }
  }, [context.facts, context.scenario, createAgent, handleEvent, transition]);

  useEffect(() => { const player = audio.current; void connect(); return () => { player.stop(); void agent.current?.end(); }; }, [connect]);

  const startMicrophone = async () => {
    microphoneFailed.current = false;
    try { await agent.current?.startMicrophone(); if (!microphoneFailed.current) setMicrophone("recording"); }
    catch { setMicrophone("typed-fallback"); setError("Microphone is unavailable. Typed fallback is active."); }
  };
  const mute = async () => {
    if (microphone === "muted") { setMicrophone(microphoneBeforeMute.current); const mutedAgent = agent.current as MuteableVoiceAgent | undefined; if (mutedAgent?.setMuted) await mutedAgent.setMuted(false); else if (microphoneBeforeMute.current === "recording") await startMicrophone(); return; }
    microphoneBeforeMute.current = microphone;
    audio.current.stop(); agent.current?.interruptCustomer(); setCustomerAudioActive(false); setMicrophone("muted"); await (agent.current as MuteableVoiceAgent | undefined)?.setMuted?.(true);
  };
  const sendTyped = () => { const text = typedText.trim(); if (!text || state === "error" || microphone === "muted") return; agent.current?.sendTypedTraineeTurn(text); setTypedText(""); setMicrophone("typed-fallback"); };
  const end = async () => { audio.current.stop(); await agent.current?.end(); transition({ type: "end" }); };
  const mockTurn = () => { (agent.current as MockControl | undefined)?.requestMockCustomerTurn?.(); };

  return <main className="max-w-6xl"><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Practice call</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{context.scenario.title}</h1><p className="mt-2 text-slate-700">You are speaking with an AI simulated customer. Answer from the confirmed session reference.</p><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]"><div className="space-y-6"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Call controls"><p className="font-semibold text-slate-950">Call status: <span className="capitalize">{state.replace("-", " ")}</span></p><p className="mt-2 text-sm text-slate-700">Microphone: {microphone === "recording" ? "Recording" : microphone === "typed-fallback" ? "Typed fallback active" : microphone === "muted" ? "Muted" : "Not started"}</p><p className="mt-1 text-sm text-slate-700">Customer audio: {customerAudioActive ? "Speaking" : customerAudioAvailability === "text-only" ? "Unavailable — transcript-only fallback" : "Idle"}</p>{error && <div role={state === "error" ? "alert" : "status"} className="mt-4 rounded-md bg-rose-50 p-3 text-rose-800">{error}{state === "error" && <button type="button" onClick={() => void connect(true)} className="ml-3 underline">Retry call</button>}</div>}<div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void startMicrophone()} disabled={state === "error" || state === "ended" || microphone === "muted"} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">Start microphone</button><button type="button" onClick={() => void mute()} disabled={state === "ended"} className="rounded-md border border-slate-300 px-4 py-2">{microphone === "muted" ? "Unmute" : "Mute"}</button><button type="button" onClick={() => void end()} disabled={state === "ended"} className="rounded-md border border-rose-300 px-4 py-2 text-rose-800">End call</button>{agent.current instanceof MockVoiceAgent && <button type="button" onClick={mockTurn} className="rounded-md border border-slate-300 px-4 py-2">Mock customer turn</button>}</div><label className="mt-5 block font-medium text-slate-900">Typed response<textarea aria-label="Typed response" value={typedText} onChange={(event) => setTypedText(event.target.value)} disabled={state === "error" || state === "ended" || microphone === "muted"} rows={3} className="mt-2 block w-full rounded-md border border-slate-300 p-3" /></label><button type="button" onClick={sendTyped} disabled={!typedText.trim() || state === "error" || state === "ended" || microphone === "muted"} className="mt-2 rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">Send typed response</button></section><TranscriptPane turns={turns} /></div><ReferencePanel context={context} /></div></main>;
}
