import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { Avatar } from "./Avatar";
import { ChatInterface } from "@/components/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";

import { KeyboardControls } from "@/components/KeyboardControls";

export default function App() {
  return (
    <div className="h-screen w-full relative bg-neutral-950 text-white overflow-hidden">
      <KeyboardControls />
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 1.5, 1.5], fov: 30 }} shadows>
          <color attach="background" args={["#1c1c1c"]} />

          {/* Lighting is crucial for VRM/MToon materials */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[1, 1, 1]} intensity={1} castShadow />

          <Suspense fallback={null}>
            <Environment preset="city" />
            <Avatar />
          </Suspense>
          <OrbitControls
            target={[0, 1.0, 0]}
            enablePan={false}
            minDistance={0.5}
            maxDistance={2.5}
          />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 p-4 z-10 pointer-events-none w-full flex flex-col items-start gap-2">
        <h1 className="text-white text-xl font-bold bg-black/50 p-2 rounded backdrop-blur-md">
          VChat AI
        </h1>
        <div className="text-xs text-white/70 bg-black/30 p-2 rounded backdrop-blur-sm hidden md:block">
          Controls:
          <br />
          WASD / Arrows : Move X/Z
          <br />
          Q / E : Move Y (Up/Down)
          <br />R : Reset
        </div>
      </div>

      <ModelSelector />
      <ChatInterface />
    </div>
  );
}
