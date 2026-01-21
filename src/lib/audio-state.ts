/**
 * Shared mutable state for audio visualization/lip-sync.
 * This allows the UI (ChatInterface) to write volume data
 * and the 3D scene (Avatar) to read it efficiently without React re-renders.
 */
export const audioState = {
  /** Current volume level normalized between 0 and 1 */
  volume: 0,
};
