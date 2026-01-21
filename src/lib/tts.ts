// Puter.js global type definition
declare global {
  interface Window {
    puter: {
      ai: {
        txt2speech: (
          text: string, 
          options?: string | { 
            voice?: string; 
            engine?: "standard" | "neural" | "generative"; 
            language?: string 
          }
        ) => Promise<HTMLAudioElement>;
      };
    };
  }
}

/**
 * Generates speech using Puter.js free API.
 * 
 * @param text The text to convert to speech.
 * @returns A Promise resolving to the HTMLAudioElement or null if failed.
 */
export async function generateSpeech(text: string): Promise<HTMLAudioElement | null> {
  if (!text.trim()) return null;

  try {
    console.log(`Generating speech for: "${text.substring(0, 20)}..."`);
    
    // Check if Puter is loaded
    if (!window.puter) {
        console.error("Puter.js not loaded");
        return null;
    }

    // Use Puter.js to generate speech
    // Using a reliable 'standard' or 'neural' engine for faster response
    const audio = await window.puter.ai.txt2speech(text, {
        engine: "neural",
        language: "en-US",
        voice: "Joanna" // Common neutral female voice often available
    });

    return audio;

  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
}

/**
 * Plays the audio element.
 * @param audio The HTMLAudioElement to play.
 */
export function playAudio(audio: HTMLAudioElement): HTMLAudioElement {
  audio.volume = 0.5; // Default volume to 50%
  audio.crossOrigin = "anonymous"; // Important for Web Audio API analysis
  audio.play().catch(e => console.error("Error playing audio:", e));
  return audio;
}
