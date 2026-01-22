import {
  VRMLoaderPlugin,
  VRMUtils,
  VRMHumanBoneName,
  VRM,
} from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { audioState } from "@/lib/audio-state";
import { expressionState } from "@/lib/expression-state";
import * as THREE from "three";
import { type VRMModelId } from "@/lib/models";
import { avatarState } from "@/lib/avatar-state";

// Helper for more natural movement (Fractal Noise simulation using Primes)
// Combining sine waves at prime frequencies prevents noticeable looping.
const naturalSine = (t: number, speed: number) => {
  return (Math.sin(t * speed) + Math.sin(t * speed * 1.3) * 0.5) / 1.5;
};

export function Avatar() {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [modelId, setModelId] = useState<VRMModelId>(
    avatarState.currentModelId,
  );

  // Memoize state object to prevent garbage collection churn
  const [transforms, setTransforms] = useState({
    position: avatarState.position,
    rotation: avatarState.rotation,
    scale: avatarState.scale,
  });
  
  const [isDancing, setIsDancing] = useState(avatarState.isDancing);
  const [isJumping, setIsJumping] = useState(avatarState.isJumping);
  const [isWaving, setIsWaving] = useState(avatarState.isWaving);

  // REFINED BLINK STATE
  const blinkState = useRef({
    isBlinking: false,
    blinkPhase: 0, // 0 to 1
    nextBlinkDelay: 2,
    closing: true, // Track direction for asymmetric speed
  });

  const talkingState = useRef({
    intensity: 0,
    mouthTarget: 0, // For smoothing lip sync
  });

  // --- MODEL SUBSCRIPTION ---
  useEffect(() => {
    const unsubscribe = avatarState.subscribe(() => {
      setModelId(avatarState.currentModelId);
      setTransforms({
        position: avatarState.position,
        rotation: avatarState.rotation,
        scale: avatarState.scale,
      });
      setIsDancing(avatarState.isDancing);
      setIsJumping(avatarState.isJumping);
      setIsWaving(avatarState.isWaving);
    });
    return unsubscribe;
  }, []);

  // --- LOADER ---
  useEffect(() => {
    // Cleanup previous model properly
    if (vrm) {
      VRMUtils.removeUnnecessaryJoints(vrm.scene);
      // Optional: dispose materials/geometries if memory is tight
    }

    const loader = new GLTFLoader();
    loader.register(
      (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }),
    );

    console.log(`Loading VRM: /vrm/${modelId}`);

    loader.load(
      `/vrm/${modelId}`,
      (gltf) => {
        const loadedVrm = gltf.userData.vrm;

        // Optimization: Only traverse once
        loadedVrm.scene.traverse((obj: THREE.Object3D) => {
          obj.frustumCulled = false;
        });

        VRMUtils.rotateVRM0(loadedVrm);

        // Initial Pose Setup (T-Pose to Neutral)
        const humanBones = loadedVrm.humanoid;

        // Helper to safely set rotation
        const setRot = (bone: string, x: number, y: number, z: number) => {
          const node = humanBones.getNormalizedBoneNode(bone as any);
          if (node) node.rotation.set(x, y, z);
        };

        // Apply static fixes once
        setRot(VRMHumanBoneName.Hips, 0, 0, 0);
        setRot(VRMHumanBoneName.LeftUpperLeg, 0, 0, 0);
        setRot(VRMHumanBoneName.RightUpperLeg, 0, 0, 0);

        setVrm(loadedVrm);
      },
      undefined,
      (error) => console.error("Error loading VRM:", error),
    );
  }, [modelId]);

  // --- ANIMATION LOOP ---
  useFrame((state, delta) => {
    if (!vrm) return;

    const t = state.clock.elapsedTime;
    const humanBones = vrm.humanoid;
    const currentEmotion = expressionState.currentEmotion;

    // 1. ORGANIC BLINKING
    // Logic: Snap close fast, hold briefly, open slightly slower.
    const bs = blinkState.current;
    const shouldStopBlinking = currentEmotion === "happy";

    if (!shouldStopBlinking) {
      bs.nextBlinkDelay -= delta;

      if (bs.nextBlinkDelay <= 0 && !bs.isBlinking) {
        bs.isBlinking = true;
        bs.closing = true;
        bs.blinkPhase = 0;
      }

      if (bs.isBlinking) {
        // Speed: Close fast (15), Open slower (8)
        const speed = bs.closing ? 15 : 8;
        bs.blinkPhase += delta * speed;

        if (bs.closing) {
          if (bs.blinkPhase >= 1) {
            bs.closing = false;
            bs.blinkPhase = 0; // Reset for opening
          }
          // Ease in cubic for snappy close
          vrm.expressionManager?.setValue(
            "blink",
            THREE.MathUtils.smoothstep(bs.blinkPhase, 0, 1),
          );
        } else {
          // Opening
          if (bs.blinkPhase >= 1) {
            bs.isBlinking = false;
            // Weighted random delay (mostly 3-4s, occasionally shorter)
            bs.nextBlinkDelay =
              Math.random() > 0.8 ? 0.5 : 2 + Math.random() * 3;
            vrm.expressionManager?.setValue("blink", 0);
          } else {
            vrm.expressionManager?.setValue(
              "blink",
              1 - THREE.MathUtils.smoothstep(bs.blinkPhase, 0, 1),
            );
          }
        }
      }
    } else {
      // If emotion overrides eyes (e.g., Happy ^_^), reset blink
      if (bs.isBlinking) {
        bs.isBlinking = false;
        vrm.expressionManager?.setValue("blink", 0);
      }
    }

    // 2. REFINED LIP SYNC
    const rawVolume = audioState.volume;
    const ts = talkingState.current;

    // Noise Gate: Ignore volume below 0.05 to prevent jitter
    const isTalking = rawVolume > 0.05;

    // Smooth transition for "Is Talking" intensity (used for gestures)
    ts.intensity = THREE.MathUtils.lerp(
      ts.intensity,
      isTalking ? 1.0 : 0.0,
      delta * 8,
    );

    if (vrm.expressionManager) {
      // Calculate target mouth open amount
      // Multiplier reduced slightly to prevent over-extension
      let targetMouth = Math.min(1.0, rawVolume * 3.5);
      if (rawVolume < 0.05) targetMouth = 0;

      // Asymmetric Smoothing: Open fast, close smooth
      const smoothingFactor = targetMouth > ts.mouthTarget ? 25 : 10;
      ts.mouthTarget = THREE.MathUtils.lerp(
        ts.mouthTarget,
        targetMouth,
        delta * smoothingFactor,
      );

      vrm.expressionManager.setValue("aa", ts.mouthTarget);

      // Emotion Blending (Optimized)
      // Only update if changed or during transition
      const emotionMap: Record<string, string> = {
        happy: "happy",
        angry: "angry",
        sad: "sad",
        surprised: "surprised",
        relaxed: "relaxed",
        neutral: "neutral",
      };

      for (const [key, name] of Object.entries(emotionMap)) {
        if (name === "neutral") continue;
        const isTarget = currentEmotion === key;
        const currentVal = vrm.expressionManager.getValue(name) || 0;
        const targetVal = isTarget ? 1.0 : 0.0;

        // Stop calculating if we are already at target 0
        if (Math.abs(currentVal - targetVal) > 0.001) {
          const nextVal = THREE.MathUtils.lerp(
            currentVal,
            targetVal,
            delta * 4,
          );
          vrm.expressionManager.setValue(name, nextVal);
        }
      }
    }

    // 3. LAYERED IDLE ANIMATIONS
    // Using "naturalSine" to mix frequencies

    // Breathing (Spine/Chest)
    // Primary breath + subtle irregularity
    const breath =
      (Math.sin(t * 0.8) * 0.5 + Math.sin(t * 0.8 * 0.33) * 0.5) * 0.03;

    const spine = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    const chest = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Chest);

    if (isDancing) {
        // --- DANCE ANIMATION ---
        const danceSpeed = 5;
        const danceBeat = t * danceSpeed;
        
        // Hips: Sway and bounce
        const hips = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Hips);
        
        // Ensure initial rotations are zeroed out before applying dance moves to prevent accumulation
        if (hips) {
            hips.rotation.set(0, 0, 0); 
            // hips.position.set(0, Math.abs(Math.sin(danceBeat)) * 0.1, 0); // DISABLED: Causing position artifacts
        }

        // Spine/Chest: Counter rotation
        if (spine) {
            spine.rotation.set(0, 0, 0);
            spine.rotation.y = Math.sin(danceBeat * 0.5 + Math.PI) * 0.05;
        }
        if (chest) {
            chest.rotation.set(0, 0, 0);
            chest.rotation.y = Math.sin(danceBeat * 0.5 + Math.PI) * 0.05;
        }

        // Arms: Pump in the air
        const leftArm = humanBones.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        const rightArm = humanBones.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
        const leftLower = humanBones.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
        const rightLower = humanBones.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);

        // More stable arm rotations
        if (leftArm) {
             leftArm.rotation.set(0, 0, 0);
             leftArm.rotation.z = Math.PI * 0.4; // Fixed raised position
             leftArm.rotation.x = Math.sin(danceBeat) * 0.2; // Wave
        }
        if (rightArm) {
             rightArm.rotation.set(0, 0, 0);
             rightArm.rotation.z = -Math.PI * 0.4; // Fixed raised position
             rightArm.rotation.x = Math.sin(danceBeat) * 0.2; // Wave
        }
        
        if (leftLower) leftLower.rotation.set(0, 0, 0);
        if (rightLower) rightLower.rotation.set(0, 0, 0);

        // Head: Bob to the beat
        const head = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Head);
        if (head) {
             head.rotation.set(0, 0, 0);
             head.rotation.x = Math.abs(Math.sin(danceBeat)) * 0.1;
        }

    } else if (isJumping) {
      // --- JUMP ANIMATION ---
      const jumpSpeed = 5;
      const jumpTime = t * jumpSpeed;
      const jumpHeight = 0.5;

      // Hips: Jump up and down
      const hips = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Hips);
      if (hips) {
        hips.rotation.set(0, 0, 0);
        // Use absolute sine wave for jumping (only goes up)
        hips.position.y = Math.abs(Math.sin(jumpTime)) * jumpHeight;
      }

      // Arms: Raise slightly during jump
      const leftArm = humanBones.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
      const rightArm = humanBones.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
      
      if (leftArm) {
          leftArm.rotation.set(0, 0, 0);
          leftArm.rotation.z = Math.PI * 0.4;
      }
      if (rightArm) {
          rightArm.rotation.set(0, 0, 0);
          rightArm.rotation.z = -Math.PI * 0.4;
      }

    } else if (isWaving) {
       // --- WAVE ANIMATION ---
       const waveSpeed = 8;
       const waveTime = t * waveSpeed;

       const rightArm = humanBones.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
       const rightLower = humanBones.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
       const rightHand = humanBones.getNormalizedBoneNode(VRMHumanBoneName.RightHand);

       if (rightArm) {
           rightArm.rotation.set(0, 0, 0);
           rightArm.rotation.z = -Math.PI * 0.8; // Raised high
           rightArm.rotation.x = Math.PI * 0.1; // Slightly forward
       }

       if (rightLower) {
           rightLower.rotation.set(0, 0, 0);
           rightLower.rotation.z = -Math.PI * 0.1 + Math.sin(waveTime) * 0.2; // Waving motion
       }

        if (rightHand) {
           rightHand.rotation.set(0, 0, 0);
           // Slight hand flourish
           rightHand.rotation.x = Math.cos(waveTime) * 0.1;
       }

    } else {
      // --- IDLE ANIMATION ---

      // RESET JUMP/DANCE ARTIFACTS
      const hips = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Hips);
      if (hips) {
        hips.rotation.set(0, 0, 0);
        hips.position.y = 0; // Ensure we land back on ground
      }
        // Reset Y/Z rotations for spine/chest as idle only uses X
        if (spine) {
            spine.rotation.y = 0;
            spine.rotation.z = 0;
        }
        if (chest) {
            chest.rotation.y = 0;
            chest.rotation.z = 0;
        }

        if (spine) spine.rotation.x = breath;
        if (chest) chest.rotation.x = breath;

        // Arms & Shoulders
        // Base Rotation logic preserved but smoothed
        const leftArm = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.LeftUpperArm,
        );
        const rightArm = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.RightUpperArm,
        );
        const leftLower = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.LeftLowerArm,
        );
        const rightLower = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.RightLowerArm,
        );

        // Dynamic Arm Sway: More sway when talking, less when silent
        const armSway = naturalSine(t, 1.5) * 0.02;
        const talkLift = ts.intensity * 0.15; // Arms lift slightly when talking

        // A-Pose correction base (approx PI/3)
        const armBaseZ = Math.PI / 2.8;

        if (leftArm) {
        // Add slight Z breathing to shoulders
        leftArm.rotation.z = armBaseZ + breath * 2 - talkLift + armSway;
        // Slight x-rotation (forward/back) for natural stance
        leftArm.rotation.x = 0.05;
        }
        if (rightArm) {
        rightArm.rotation.z = -armBaseZ - breath * 2 + talkLift - armSway;
        rightArm.rotation.x = 0.05;
        }

        if (leftLower) leftLower.rotation.z = -0.15 - ts.intensity * 0.1;
        if (rightLower) rightLower.rotation.z = 0.15 + ts.intensity * 0.1;

        // HEAD & NECK
        // This is where "robotic" feel usually comes from.
        // We add a "Micro-movement" layer that is independent of breathing.
        const head = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Head);
        const neck = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Neck);

        const headX = naturalSine(t, 0.4) * 0.04; // Very slow nod
        const headY = naturalSine(t, 0.25) * 0.05; // Very slow drift

        // Talking bob - smoother, less "vibrating"
        const talkBob = Math.sin(t * 10) * 0.03 * ts.intensity;

        if (neck) {
        // Neck takes 40% of the rotation
        neck.rotation.y = headY * 0.4;
        neck.rotation.x = headX * 0.4 + talkBob * 0.3;
        }
        if (head) {
        // Head takes 60% of the rotation
        head.rotation.y = headY * 0.6;
        head.rotation.x = headX * 0.6 + talkBob * 0.7;

        // Add subtle "Attitude" tilt (Z-axis) based on sway
        head.rotation.z = -headY * 0.2;
        }
    }

    // Update VRM Physics
    vrm.update(delta);
  });

  if (!vrm) return null;

  return (
    <group
      position={[
        transforms.position.x,
        transforms.position.y,
        transforms.position.z,
      ]}
      rotation={[
        transforms.rotation.x,
        transforms.rotation.y,
        transforms.rotation.z,
      ]}
      scale={transforms.scale}
    >
      <primitive object={vrm.scene} />
    </group>
  );
}
