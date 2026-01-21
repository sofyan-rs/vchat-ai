/**
 * Shared mutable state for avatar facial expressions.
 * This allows the UI to trigger expressions based on text analysis
 * and the 3D scene to render them smoothly.
 */

export type Emotion = "neutral" | "happy" | "angry" | "sad" | "surprised" | "relaxed";

export const expressionState = {
  /** The target emotion to render */
  currentEmotion: "neutral" as Emotion,
  
  /** 
   * Timestamp of the last emotion update. 
   * Can be used to auto-reset to neutral after some time if needed.
   */
  lastUpdate: 0,
};
