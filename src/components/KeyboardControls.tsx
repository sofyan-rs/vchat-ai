import { useEffect } from "react";
import { avatarState } from "@/lib/avatar-state";

export function KeyboardControls() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const step = 0.1; // Movement step size

      switch (e.key) {
        // X Axis (Left/Right) - Arrow Keys or A/D
        case "ArrowLeft":
        case "a":
        case "A":
          avatarState.setPosition("x", avatarState.position.x - step);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          avatarState.setPosition("x", avatarState.position.x + step);
          break;

        // Y Axis (Up/Down) - PageUp/PageDown or Q/E
        case "PageUp":
        case "q":
        case "Q":
          avatarState.setPosition("y", avatarState.position.y + step);
          break;
        case "PageDown":
        case "e":
        case "E":
          avatarState.setPosition("y", avatarState.position.y - step);
          break;

        // Z Axis (Forward/Backward) - Arrow Up/Down or W/S
        case "ArrowUp":
        case "w":
        case "W":
          avatarState.setPosition("z", avatarState.position.z - step);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          avatarState.setPosition("z", avatarState.position.z + step);
          break;
          
        // Reset
        case "r":
        case "R":
          avatarState.resetTransforms();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null; // Logic-only component
}
