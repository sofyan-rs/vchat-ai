export const VRM_MODELS = [
  { id: "yangyang.vrm", name: "Yangyang" },
  { id: "chixia.vrm", name: "Chixia" },
  { id: "jinshi.vrm", name: "Jinshi" },
  { id: "yinlin.vrm", name: "Yinlin" },
  { id: "frover.vrm", name: "Frover" },
  { id: "phoebe.vrm", name: "Phoebe" },
  { id: "cantarella.vrm", name: "Cantarella" },
  { id: "carlotta.vrm", name: "Carlotta" },
  { id: "carthetiya.vrm", name: "Carthetiya" },
  { id: "fleurdelys.vrm", name: "Fleurdelys" },
] as const;

export type VRMModelId = (typeof VRM_MODELS)[number]["id"];
