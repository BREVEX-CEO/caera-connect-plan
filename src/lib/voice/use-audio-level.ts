import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How loud the room is right now, as one number between 0 and 1.
 *
 * WHY THE ORB NEEDS THIS AND THE RECOGNISER CANNOT PROVIDE IT. Speech
 * recognition reports words; it says nothing about level, and it says nothing
 * at all until it has decided something is a word. An orb driven by that would
 * sit still through the whole of a sentence and then jump — which reads as a
 * lag, not as listening. This reads the waveform directly, so quiet speech is
 * a small ripple and a raised voice is a real one.
 *
 * IT IS AMPLITUDE AND A LITTLE SHAPE, NOT CONTENT. The analyser is asked for
 * levels only: nothing here transcribes, stores, uploads or retains audio, and
 * the numbers never leave the tab. `docs/DESIGN.md` asks for amplitude AND
 * frequency reactivity, so `tilt` reports where the energy sits — low for a
 * voice, high for sibilance — which the renderer uses to bias its motion. That
 * is the entire extent of what is derived from the signal.
 *
 * THE MICROPHONE IS OPENED ONLY WHILE ASKED FOR, AND CLOSED BY STOPPING THE
 * TRACKS, not merely by dropping the reference: an open track keeps the
 * browser's recording indicator lit, and a product that leaves that on after
 * the user stopped talking to it has taken something it was not given.
 */
export interface AudioLevel {
  /** 0–1, RMS of the current window. */
  level: number;
  /** 0–1. Low means the energy is in the low band, high means it is not. */
  tilt: number;
  listening: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useAudioLevel(): AudioLevel {
  const [level, setLevel] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const frame = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
    void context.current?.close().catch(() => undefined);
    context.current = null;
    setListening(false);
    setLevel(0);
    setTilt(0);
  }, []);

  const start = useCallback(async () => {
    if (stream.current) return;
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser cannot measure audio.");
      const audio = new AudioContextClass();
      context.current = audio;
      const source = audio.createMediaStreamSource(media);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 1024;
      // Smoothed in the analyser rather than in React: a level that updates
      // state sixty times a second would re-render the whole room.
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      const wave = new Float32Array(analyser.fftSize);
      const spectrum = new Uint8Array(analyser.frequencyBinCount);
      setListening(true);

      let lastPublished = 0;
      const read = () => {
        analyser.getFloatTimeDomainData(wave);
        let sum = 0;
        for (const sample of wave) sum += sample * sample;
        const rms = Math.sqrt(sum / wave.length);
        /*
         * Speech sits far below full scale, so raw RMS would leave the orb
         * almost still. The curve lifts ordinary talking into the middle of
         * the range and still leaves headroom for a shout.
         */
        const shaped = Math.min(1, Math.sqrt(rms) * 2.4);

        analyser.getByteFrequencyData(spectrum);
        const half = Math.floor(spectrum.length / 2);
        let low = 0;
        let high = 0;
        for (let index = 0; index < spectrum.length; index += 1) {
          if (index < half) low += spectrum[index];
          else high += spectrum[index];
        }
        const total = low + high;

        // At most twenty updates a second. The renderer interpolates; React
        // does not need to see every frame.
        const now = performance.now();
        if (now - lastPublished > 50) {
          lastPublished = now;
          setLevel(shaped);
          setTilt(total > 0 ? high / total : 0);
        }
        frame.current = requestAnimationFrame(read);
      };
      read();
    } catch (cause) {
      stop();
      setError(
        cause instanceof Error && cause.name === "NotAllowedError"
          ? "OCADE needs permission to use your microphone. Allow it in your browser and try again."
          : cause instanceof Error
            ? cause.message
            : "This browser would not open the microphone.",
      );
    }
  }, [stop]);

  // Leaving the room releases the microphone. Nothing else has to remember to.
  useEffect(() => stop, [stop]);

  return { level, tilt, listening, error, start, stop };
}
