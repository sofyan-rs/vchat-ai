import { type VRMModelId } from "@/lib/models";

type Listener = () => void;

export const avatarState = {
  currentModelId: "fleurdelys.vrm" as VRMModelId,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 }, // Changed from Math.PI to 0 to face front
  scale: 1.0,
  
  listeners: [] as Listener[],

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  emit() {
    this.listeners.forEach(l => l());
  },

  setModel(id: VRMModelId) {
    this.currentModelId = id;
    this.emit();
  },

  setPosition(axis: "x" | "y" | "z", value: number) {
    this.position[axis] = value;
    this.emit();
  },

  setRotation(axis: "x" | "y" | "z", value: number) {
    this.rotation[axis] = value;
    this.emit();
  },

  setScale(value: number) {
    this.scale = value;
    this.emit();
  },
  
  resetTransforms() {
      this.position = { x: 0, y: 0, z: 0 };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = 1.0;
      this.emit();
  }
};
