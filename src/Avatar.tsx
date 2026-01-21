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

export function Avatar() {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [modelId, setModelId] = useState<VRMModelId>(
    avatarState.currentModelId,
  );
  const [transforms, setTransforms] = useState({
    position: avatarState.position,
    rotation: avatarState.rotation,
    scale: avatarState.scale,
  });

  const blinkState = useRef({
    isBlinking: false,
    blinkProgress: 0,
    nextBlinkDelay: 2, // Initial delay in seconds
  });

  const talkingState = useRef({
    intensity: 0,
    time: 0,
  });

  useEffect(() => {
    // Subscribe to model changes
    const unsubscribe = avatarState.subscribe(() => {
      setModelId(avatarState.currentModelId);
      setTransforms({
        position: avatarState.position,
        rotation: avatarState.rotation,
        scale: avatarState.scale,
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Clean up previous VRM if exists
    // We do this cleanup inside a cleanup function or before loading new one, but
    // setting state here triggers a re-render.
    // Instead of setVrm(null) immediately which triggers the error, we can just rely on the new loader overwriting it.
    // Or if we really want to clear it, we should do it in a cleanup function of the previous effect, or just let the new one replace it.

    // Actually, the best way to handle "unmounting" the old model is the cleanup function of THIS effect.
    return () => {
      if (vrm) {
        VRMUtils.removeUnnecessaryJoints(vrm.scene);
        // We don't need to setVrm(null) here because the component is unmounting or dependency changing
        // and the next render cycle will initialize or the new effect run will handle it.
        // But if we want to visually clear it while loading, we should use a separate loading state.
      }
    };
  }, [vrm]); // Add vrm as dependency for cleanup

  useEffect(() => {
    const loader = new GLTFLoader();

    // Explicitly configure the plugin
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser, {
        autoUpdateHumanBones: true,
      });
    });

    console.log(`Loading VRM: /vrm/${modelId}`);

    loader.load(
      `/vrm/${modelId}`,
      (gltf) => {
        const vrm = gltf.userData.vrm;

        // Disable frustum culling to prevent model disappearing
        vrm.scene.traverse((obj: THREE.Object3D) => {
          obj.frustumCulled = false;
        });

        VRMUtils.rotateVRM0(vrm); // Fix rotation for VRM 0.x models if needed

        // --- APPLY DEFAULT POSE ---
        const humanBones = vrm.humanoid;

        // Arms - relaxed at sides
        // REVERSED rotation direction based on user feedback
        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.LeftUpperArm,
        )!.rotation.z = Math.PI / 3.0; // Reduced from 2.5 to 3.0 to lower the A-pose lift

        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.RightUpperArm,
        )!.rotation.z = -Math.PI / 3.0;

        // Fix for "skirt lifting" / weird leg interaction
        // Sometimes if the default pose is too compressed, clothes physics (spring bones) can freak out
        // Let's ensure the legs are in a neutral standing pose
        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.LeftUpperLeg,
        )!.rotation.z = 0;
        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.RightUpperLeg,
        )!.rotation.z = 0;

        // Reset any weird hip rotation
        const hips = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Hips);
        if (hips) {
          hips.rotation.set(0, 0, 0);
        }

        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.LeftLowerArm,
        )!.rotation.z = -0.1;
        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.RightLowerArm,
        )!.rotation.z = 0.1;

        // Hands - relaxed
        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.LeftHand,
        )!.rotation.z = -0.1;
        humanBones.getNormalizedBoneNode(
          VRMHumanBoneName.RightHand,
        )!.rotation.z = 0.1;

        setVrm(vrm);
        console.log("VRM loaded:", vrm);
      },
      (progress) =>
        console.log(
          "Loading model...",
          100.0 * (progress.loaded / progress.total),
          "%",
        ),
      (error) => console.error("Error loading VRM:", error),
    );
  }, [modelId]);

  // VRM requires an update loop for physics (hair, clothes, etc.)
  useFrame((_state, delta) => {
    if (vrm) {
      // --- BLINK LOGIC ---
      const bs = blinkState.current;
      const currentEmotion = expressionState.currentEmotion;

      // Disable blinking if eyes are closed due to emotion (happy, sad, sleeping)
      // "happy" usually closes eyes in anime style (^_^), same for "sad" (T_T) sometimes.
      // We will assume "happy" and "sad" might involve closed eyes, so we pause blinking.
      // But actually, let's just pause it for 'happy' and 'sleeping' (if we had it).
      // For now, let's just say if emotion is 'happy' (often ^_^) or 'sleeping', we skip blink logic.
      const shouldBlink =
        currentEmotion !== "happy" && currentEmotion !== "sad";

      if (shouldBlink) {
        if (bs.isBlinking) {
          // Animate blink: 0 -> PI (sin(0)=0, sin(PI/2)=1, sin(PI)=0)
          bs.blinkProgress += delta * 15; // Speed of blink

          if (bs.blinkProgress >= Math.PI) {
            bs.isBlinking = false;
            bs.blinkProgress = 0;
            bs.nextBlinkDelay = Math.random() * 3 + 1; // Random delay 1-4s
            if (vrm.expressionManager) {
              vrm.expressionManager.setValue("blink", 0);
            }
          } else {
            const blinkValue = Math.sin(bs.blinkProgress);
            if (vrm.expressionManager) {
              vrm.expressionManager.setValue("blink", blinkValue);
            }
          }
        } else {
          bs.nextBlinkDelay -= delta;
          if (bs.nextBlinkDelay <= 0) {
            bs.isBlinking = true;
            bs.blinkProgress = 0;
          }
        }
      } else {
        // If we shouldn't blink, ensure blink is 0 so we don't get stuck half-blinked
        if (vrm.expressionManager) {
          vrm.expressionManager.setValue("blink", 0);
        }
        bs.isBlinking = false;
      }

      // --- LIP SYNC LOGIC ---
      const isTalking = audioState.volume > 0.01;
      const ts = talkingState.current;

      // Smoothly transition talking intensity
      const targetIntensity = isTalking ? 1.0 : 0.0;
      ts.intensity = THREE.MathUtils.lerp(
        ts.intensity,
        targetIntensity,
        delta * 5,
      ); // Fast transition

      if (vrm.expressionManager) {
        // 1. Lip Sync
        // Boost sensitivity significantly so normal speech volume triggers full mouth opening
        const targetOpen = Math.min(1.0, audioState.volume * 4.0);
        const currentOpen = vrm.expressionManager.getValue("aa");

        // Increase smoothing factor slightly (25 -> 20) to make it a tiny bit slower/smoother
        const smoothedOpen = THREE.MathUtils.lerp(
          currentOpen || 0,
          targetOpen,
          1 - Math.exp(-delta * 20),
        );

        vrm.expressionManager.setValue("aa", smoothedOpen);

        // 2. Emotional Expressions
        // Smoothly blend to the target emotion
        const currentEmotion = expressionState.currentEmotion;

        // Define standard VRM blendshapes for emotions
        const emotionMap: Record<string, string> = {
          happy: "happy",
          angry: "angry",
          sad: "sad",
          surprised: "surprised",
          relaxed: "relaxed",
          neutral: "neutral",
        };

        // We only want to set the active one, and fade out others
        // Iterate through all known emotions
        Object.values(emotionMap).forEach((emotionName) => {
          if (emotionName === "neutral") return; // Neutral is default (all 0)

          const targetValue = currentEmotion === emotionName ? 1.0 : 0.0;
          const currentValue =
            vrm?.expressionManager?.getValue(emotionName) || 0;

          // Smooth transition
          const newValue = THREE.MathUtils.lerp(
            currentValue,
            targetValue,
            delta * 3,
          );

          // Only set if supported
          if (vrm?.expressionManager?.getExpression(emotionName)) {
            vrm?.expressionManager?.setValue(emotionName, newValue);
          }
        });
      }

      // --- IDLE ANIMATION LOGIC ---
      const t = _state.clock.elapsedTime;
      const humanBones = vrm.humanoid;

      // 1. Breathing (Spine/Chest)
      // Gentle expansion/contraction
      const spine = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Spine);
      const chest = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Chest);
      const upperChest = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.UpperChest,
      );

      const breath = Math.sin(t * 0.8) * 0.02; // Slow sine wave
      if (spine) spine.rotation.x = breath;
      if (chest) chest.rotation.x = breath;
      if (upperChest) upperChest.rotation.x = breath;

      // 2. Subtle Sway (Hips/Root)
      // Very slight figure-8 or side-to-side movement
      const hips = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Hips);
      if (hips) {
        // hips.rotation.y = Math.sin(t * 0.5) * 0.02; // Sway Y
        // hips.position.y = Math.sin(t * 1.0) * 0.005; // Bob up/down slightly
      }

      // 3. Arms Breathing (sync with chest)
      // Base rotation is PI/3.0 (~1.04 rad)
      const leftArm = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.LeftUpperArm,
      );
      const rightArm = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.RightUpperArm,
      );
      const leftLowerArm = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.LeftLowerArm,
      );
      const rightLowerArm = humanBones.getNormalizedBoneNode(
        VRMHumanBoneName.RightLowerArm,
      );

      const armBreath = Math.sin(t * 0.8) * 0.03;

      // Talking gestures (arms)
      // When talking, lift arms slightly and open them a bit more
      const talkArmLift = ts.intensity * 0.1; // Lift arms by 0.1 rad
      const talkArmOpen = Math.sin(t * 8) * 0.02 * ts.intensity; // Fast jitter/movement when talking

      // Base: Math.PI / 3.0
      if (leftArm)
        leftArm.rotation.z =
          Math.PI / 3.0 + armBreath - talkArmLift + talkArmOpen;
      if (rightArm)
        rightArm.rotation.z =
          -(Math.PI / 3.0) - armBreath + talkArmLift - talkArmOpen;

      // Forearms - slightly more expressive when talking
      if (leftLowerArm) leftLowerArm.rotation.z = -0.1 - ts.intensity * 0.2;
      if (rightLowerArm) rightLowerArm.rotation.z = 0.1 + ts.intensity * 0.2;

      // 4. Head/Neck slight movement (Perlin noise-ish using mixed sines)
      const head = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Head);
      const neck = humanBones.getNormalizedBoneNode(VRMHumanBoneName.Neck);

      const headX = Math.sin(t * 0.3) * 0.02 + Math.sin(t * 0.7) * 0.01;
      const headY = Math.cos(t * 0.25) * 0.03;

      // Talking head bob
      // Faster, more rhythmic nodding when speaking
      const talkBob = Math.abs(Math.sin(t * 12)) * 0.05 * ts.intensity;

      if (neck) {
        neck.rotation.y = headY * 0.5;
        neck.rotation.x = headX * 0.5 + talkBob * 0.5;
      }
      if (head) {
        head.rotation.y = headY * 0.5;
        head.rotation.x = headX * 0.5 + talkBob * 0.5;
      }

      vrm.update(delta);
    }
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
