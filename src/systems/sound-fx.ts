// -----------------------------------------------------------------------------
// carrot-code — Sound FX (WebAudio-synthesized chiptune SFX)
//
// Demo-sprint audio layer. Generates retro arcade beeps via the Web
// Audio API instead of loading audio files - zero asset trail, zero
// download cost, no license decisions, ships in one commit.
//
// Real CC0 sound effects from Kenney.nl can swap in later via a new
// "audio" variant on AssetDeclaration; this module is a drop-in
// replacement at the call sites.
//
// Three exposed playback methods:
//   - playJump()           short ascending sweep (chip-tune blip)
//   - playCarrotCollect()  bright two-tone chime
//   - playPowerup()        four-note ascending arpeggio
//
// Mute is global (persisted in sessionStorage so it survives
// Play-again restarts within the tab but not across tabs). UIScene
// adds the user-visible toggle button.
//
// iOS Safari requires a user gesture before audio can play; we
// satisfy that on the MenuScene Play button. If the first call
// arrives before any gesture, the resume() promise is silently
// swallowed and the next call (post-gesture) succeeds.
//
// Per-frame cost: each play creates one OscillatorNode + one
// GainNode, both auto-disconnected via the AudioParam schedule.
// No long-lived oscillator state.
//
// See:
//   src/scenes/UIScene.ts             — mute toggle button
//   src/entities/hero.ts              — jump call site
//   src/scenes/LevelScene.ts          — collect / pickup call sites
//   docs/art-direction.md             — keeps audio off the "out of
//                                       scope" list for v0.1
// -----------------------------------------------------------------------------

/** sessionStorage key for the mute toggle. */
const MUTE_STORAGE_KEY = "carrot-code:v1:muted";

/** Registry key the shared SoundFx instance is mounted under. */
export const REGISTRY_KEY_SOUND_FX = "soundFx";

/**
 * Lightweight WebAudio-based SFX player. Single instance lives on the
 * Phaser game registry; scenes / entities call playX() methods on it.
 *
 * Constructed eagerly at game-boot (cheap; no AudioContext until
 * first play). All synthesis is procedural - no audio file assets.
 */
export class SoundFx {
  /** Lazily-created shared AudioContext. */
  private ctx: AudioContext | undefined;
  /** Current mute state. Synced with sessionStorage on construct + change. */
  private muted: boolean;

  public constructor() {
    this.muted = readMutedFromSession();
  }

  /** True when audio should be suppressed. */
  public isMuted(): boolean {
    return this.muted;
  }

  /** Toggle muted state; persist in sessionStorage. */
  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Set muted state explicitly; persist in sessionStorage. */
  public setMuted(value: boolean): void {
    this.muted = value;
    writeMutedToSession(value);
  }

  /** Short ascending chip-tune blip for hero jump. */
  public playJump(): void {
    this.playEnvelope({
      type: "square",
      freqStartHz: 260,
      freqEndHz: 620,
      durationSec: 0.085,
      peakGain: 0.12,
    });
  }

  /** Two-tone bright chime for carrot pickup. */
  public playCarrotCollect(): void {
    // Two oscillators stacked = perfect-fifth interval (C6 + G6).
    this.playEnvelope({
      type: "sine",
      freqStartHz: 1047,
      freqEndHz: 1047,
      durationSec: 0.16,
      peakGain: 0.1,
    });
    this.playEnvelope({
      type: "sine",
      freqStartHz: 1568,
      freqEndHz: 1568,
      durationSec: 0.16,
      peakGain: 0.07,
    });
  }

  /** Four-note ascending arpeggio for powerup pickup. */
  public playPowerup(): void {
    // C5 -> E5 -> G5 -> C6 quick ascending arp.
    const notes = [523, 659, 784, 1047];
    const noteDur = 0.07;
    for (let i = 0; i < notes.length; i += 1) {
      const freq = notes[i] ?? 523;
      this.playEnvelope({
        type: "square",
        freqStartHz: freq,
        freqEndHz: freq,
        durationSec: noteDur,
        peakGain: 0.1,
        startOffsetSec: i * noteDur,
      });
    }
  }

  /**
   * Internal: schedule one oscillator with an attack-decay envelope.
   * Auto-stops + disconnects when the envelope ends.
   */
  private playEnvelope(params: {
    readonly type: OscillatorType;
    readonly freqStartHz: number;
    readonly freqEndHz: number;
    readonly durationSec: number;
    readonly peakGain: number;
    readonly startOffsetSec?: number;
  }): void {
    if (this.muted) {
      return;
    }
    const ctx = this.requireContext();
    if (ctx === undefined) {
      // No audio support; bail silently. Game still plays.
      return;
    }
    // iOS Safari can leave the AudioContext in "suspended" state until
    // a user gesture wakes it. resume() is a no-op when not needed and
    // returns a Promise we don't need to await; ignore the rejection
    // path (means no gesture yet - the next sound after one will work).
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // intentionally empty
      });
    }

    const startAt = ctx.currentTime + (params.startOffsetSec ?? 0);
    const endAt = startAt + params.durationSec;

    const osc = ctx.createOscillator();
    osc.type = params.type;
    osc.frequency.setValueAtTime(params.freqStartHz, startAt);
    if (params.freqEndHz !== params.freqStartHz) {
      osc.frequency.linearRampToValueAtTime(params.freqEndHz, endAt);
    }

    const gain = ctx.createGain();
    // Attack 8ms, sustain at peak, release through end. Avoids click
    // at the start and stop of the note.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(params.peakGain, startAt + 0.008);
    gain.gain.setValueAtTime(params.peakGain, endAt - 0.02);
    gain.gain.linearRampToValueAtTime(0, endAt);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.01);
    osc.onended = (): void => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * Lazily create (or return cached) AudioContext. Returns undefined
   * if Web Audio is unavailable (very old browsers, some test envs).
   */
  private requireContext(): AudioContext | undefined {
    if (this.ctx !== undefined) {
      return this.ctx;
    }
    // Some older Safari uses webkitAudioContext; guard but don't go
    // out of our way - target browsers all support the standard name.
    if (typeof AudioContext === "undefined") {
      return undefined;
    }
    try {
      this.ctx = new AudioContext();
      return this.ctx;
    } catch {
      return undefined;
    }
  }
}

/** Read the persisted mute state from sessionStorage; defaults false. */
function readMutedFromSession(): boolean {
  try {
    return window.sessionStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    // sessionStorage can throw on privacy-mode Safari; default unmuted.
    return false;
  }
}

/** Persist mute state to sessionStorage. Best-effort, swallows errors. */
function writeMutedToSession(value: boolean): void {
  try {
    window.sessionStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Same Safari quirk as above; non-blocking degradation per
    // HANDOVER's design ground rules.
  }
}
