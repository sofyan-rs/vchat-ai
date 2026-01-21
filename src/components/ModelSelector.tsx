import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { VRM_MODELS, type VRMModelId } from "@/lib/models";
import { avatarState } from "@/lib/avatar-state";
import { UserCog, Move3d, Rotate3d, Minimize2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function ModelSelector() {
  const [currentModel, setCurrentModel] = useState<VRMModelId>(
    avatarState.currentModelId,
  );
  const [position, setPosition] = useState(avatarState.position);
  const [rotation, setRotation] = useState(avatarState.rotation);
  const [scale, setScale] = useState(avatarState.scale);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = avatarState.subscribe(() => {
      setCurrentModel(avatarState.currentModelId);
      setPosition({ ...avatarState.position });
      setRotation({ ...avatarState.rotation });
      setScale(avatarState.scale);
    });
    return unsubscribe;
  }, []);

  const handleSelect = (id: VRMModelId) => {
    avatarState.setModel(id);
  };

  const currentName =
    VRM_MODELS.find((m) => m.id === currentModel)?.name || "Unknown";

  return (
    <div className="absolute top-4 right-4 z-20 flex gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-black/60 border-cyan-500/30 text-cyan-400 hover:bg-black/80 hover:text-cyan-300 backdrop-blur-md"
          >
            <UserCog className="w-4 h-4 mr-2" />
            {currentName}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="bg-black/90 border-cyan-500/30 text-white backdrop-blur-xl max-h-[80vh] w-75 overflow-y-auto p-4"
          sideOffset={8}
        >
          <DropdownMenuLabel className="text-cyan-400 font-bold mb-2">
            Select Model
          </DropdownMenuLabel>
          <div className="grid grid-cols-1 gap-1 mb-4 max-h-37.5 overflow-y-auto pr-2 border border-white/10 rounded p-1">
            {VRM_MODELS.map((model) => (
              <div
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className={cn(
                  "px-2 py-1.5 text-sm rounded cursor-pointer transition-colors",
                  currentModel === model.id
                    ? "bg-cyan-900/50 text-cyan-300"
                    : "hover:bg-white/10 text-gray-300",
                )}
              >
                {model.name}
              </div>
            ))}
          </div>

          <DropdownMenuSeparator className="bg-white/10 my-4" />

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Move3d className="w-4 h-4" /> Position
            </div>

            <div className="space-y-3 px-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>X (Left/Right)</span>
                  <span>{position.x.toFixed(2)}</span>
                </div>
                <Slider
                  value={[position.x]}
                  min={-2}
                  max={2}
                  step={0.05}
                  onValueChange={([v]) => avatarState.setPosition("x", v)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Y (Up/Down)</span>
                  <span>{position.y.toFixed(2)}</span>
                </div>
                <Slider
                  value={[position.y]}
                  min={-2}
                  max={2}
                  step={0.05}
                  onValueChange={([v]) => avatarState.setPosition("y", v)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Z (Forward/Back)</span>
                  <span>{position.z.toFixed(2)}</span>
                </div>
                <Slider
                  value={[position.z]}
                  min={-2}
                  max={2}
                  step={0.05}
                  onValueChange={([v]) => avatarState.setPosition("z", v)}
                />
              </div>
            </div>

            <DropdownMenuSeparator className="bg-white/10 my-4" />

            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Rotate3d className="w-4 h-4" /> Rotation
            </div>

            <div className="space-y-3 px-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Y (Spin)</span>
                  <span>{(rotation.y * (180 / Math.PI)).toFixed(0)}°</span>
                </div>
                <Slider
                  value={[rotation.y]}
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.1}
                  onValueChange={([v]) => avatarState.setRotation("y", v)}
                />
              </div>
            </div>

            <DropdownMenuSeparator className="bg-white/10 my-4" />

            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Minimize2 className="w-4 h-4" /> Scale
            </div>
            <div className="space-y-3 px-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Size</span>
                  <span>{scale.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[scale]}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  onValueChange={([v]) => avatarState.setScale(v)}
                />
              </div>
            </div>

            <Button
              variant="destructive"
              className="w-full mt-4 "
              onClick={() => avatarState.resetTransforms()}
            >
              Reset Transforms
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
