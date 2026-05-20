// -----------------------------------------------------------------------------
// carrot-code — Touch input store (T035)
//
// Singleton boolean flags that UIScene writes to when on-screen touch
// buttons are pressed, and that the Hero entity reads each frame to
// build its HeroInput snapshot. The store is the seam (Principle XI):
// touch buttons don't know about the Hero, and the Hero doesn't know
// about UIScene — they communicate through this small shared store.
//
// "Fresh press" semantics: the jump button has a one-shot edge detect.
// UIScene calls setJump(true) on pointerdown, setJump(false) on
// pointerup. The Hero entity calls consumeJumpPressed() each frame; it
// returns true exactly once per press, then false until the next
// release-then-press cycle. This mirrors Phaser's
// Phaser.Input.Keyboard.JustDown() semantics for keyboard.
//
// Pure-logic surface: no Phaser, no DOM, no window. Tested in 11 cases
// at tests/unit/touch-input-store.test.ts.
//
// See:
//   src/scenes/UIScene.ts             — writer (touch buttons)
//   src/entities/hero.ts              — reader (frame input snapshot)
//   .specify/memory/constitution.md   — Principles VI + XI
// -----------------------------------------------------------------------------

/**
 * Shared mutable boolean flags driven by on-screen touch buttons.
 *
 * Mounted on the Phaser scene registry under the
 * {@link REGISTRY_KEY_TOUCH_INPUT} key by `game.ts` at postBoot.
 * Empty (all false) on devices with no touch buttons rendered — so
 * the Hero can read it unconditionally without branching on
 * "is this a touch device?".
 */
export class TouchInputStore {
  private _left = false;
  private _right = false;
  private _jumpHeld = false;
  /**
   * True for exactly one frame after a fresh setJump(true). Cleared
   * by the next consumeJumpPressed() call. Mirrors keyboard
   * Phaser.Input.Keyboard.JustDown() so the resolver can treat both
   * input modes identically.
   */
  private _jumpJustPressed = false;

  /** Set the left-direction held state. */
  public setLeft(down: boolean): void {
    this._left = down;
  }

  /** Set the right-direction held state. */
  public setRight(down: boolean): void {
    this._right = down;
  }

  /**
   * Set the jump held state. Transition from `false → true` queues a
   * one-shot "fresh press" that the next {@link consumeJumpPressed}
   * call returns. Releases (`true → false`) clear the held state
   * without queuing a press.
   *
   * @param down - Whether the jump button is currently held.
   */
  public setJump(down: boolean): void {
    if (down && !this._jumpHeld) {
      this._jumpJustPressed = true;
    }
    this._jumpHeld = down;
  }

  /** Whether the left button is currently held. */
  public get left(): boolean {
    return this._left;
  }

  /** Whether the right button is currently held. */
  public get right(): boolean {
    return this._right;
  }

  /** Whether the jump button is currently held. */
  public get jumpHeld(): boolean {
    return this._jumpHeld;
  }

  /**
   * Return whether a fresh jump-press happened since the last call
   * and clear the flag. The flag is one-shot: subsequent calls within
   * the same press return false. Caller (Hero.update) invokes this
   * once per frame.
   *
   * @returns `true` if a fresh press is pending.
   */
  public consumeJumpPressed(): boolean {
    const wasPressed = this._jumpJustPressed;
    this._jumpJustPressed = false;
    return wasPressed;
  }
}

/** Registry key the TouchInputStore is mounted under. */
export const REGISTRY_KEY_TOUCH_INPUT = "touchInputStore";
