// Input handling system for keyboard and touch events
import { InputState } from '../types';

export class InputHandler {
  private inputState: InputState;
  private keyMap: Map<string, keyof InputState>;
  private activeKeys: Set<string>;

  constructor() {
    this.inputState = {
      jump: false,
      restart: false,
      pause: false,
    };

    // Map keyboard keys to input actions
    this.keyMap = new Map([
      [' ', 'jump'], // Space bar
      ['ArrowUp', 'jump'], // Up arrow
      ['w', 'jump'], // W key
      ['W', 'jump'],
      ['r', 'restart'], // R key
      ['R', 'restart'],
      ['p', 'pause'], // P key
      ['P', 'pause'],
      ['Escape', 'pause'], // Escape key
    ]);

    this.activeKeys = new Set();
    this.setupEventListeners();
  }

  /**
   * Set up keyboard and touch event listeners
   */
  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Touch/click events (for mobile and mouse)
    window.addEventListener('mousedown', this.handlePointerDown.bind(this));
    window.addEventListener('mouseup', this.handlePointerUp.bind(this));
    window.addEventListener('touchstart', this.handlePointerDown.bind(this), { passive: false });
    window.addEventListener('touchend', this.handlePointerUp.bind(this), { passive: false });
  }

  /**
   * Handle key down events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const action = this.keyMap.get(event.key);

    if (action) {
      event.preventDefault();

      // Prevent key repeat for single-press actions
      if (!this.activeKeys.has(event.key)) {
        this.inputState[action] = true;
        this.activeKeys.add(event.key);
      }
    }
  }

  /**
   * Handle key up events
   */
  private handleKeyUp(event: KeyboardEvent): void {
    const action = this.keyMap.get(event.key);

    if (action) {
      event.preventDefault();
      this.inputState[action] = false;
      this.activeKeys.delete(event.key);
    }
  }

  /**
   * Handle pointer down (mouse/touch)
   */
  private handlePointerDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.inputState.jump = true;
  }

  /**
   * Handle pointer up (mouse/touch)
   */
  private handlePointerUp(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.inputState.jump = false;
  }

  /**
   * Get the current input state
   */
  getInputState(): InputState {
    return { ...this.inputState };
  }

  /**
   * Check if a specific action is active
   */
  isActionActive(action: keyof InputState): boolean {
    return this.inputState[action];
  }

  /**
   * Reset all input states
   */
  reset(): void {
    this.inputState.jump = false;
    this.inputState.restart = false;
    this.inputState.pause = false;
    this.activeKeys.clear();
  }

  /**
   * Consume an action (set it to false after reading)
   * Useful for single-press actions like restart and pause
   */
  consumeAction(action: keyof InputState): boolean {
    const value = this.inputState[action];
    if (value) {
      this.inputState[action] = false;
    }
    return value;
  }

  /**
   * Clean up event listeners (call when destroying the game)
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('mousedown', this.handlePointerDown.bind(this));
    window.removeEventListener('mouseup', this.handlePointerUp.bind(this));
    window.removeEventListener('touchstart', this.handlePointerDown.bind(this));
    window.removeEventListener('touchend', this.handlePointerUp.bind(this));
  }
}
