# Product Requirements Document (PRD): 3D VRM Chatbot

## 1. Project Overview
A web-based chatbot application featuring an interactive 3D VTuber avatar (VRM format). The application will combine a modern chat interface with a 3D scene where the avatar reacts or animates based on interactions.

## 2. Technical Stack
- **Runtime:** Bun
- **Framework:** React (Vite)
- **Language:** TypeScript
- **UI Library:** Shadcn UI (Tailwind CSS)
- **3D Engine:** Three.js / React Three Fiber (R3F)
- **VRM Loader:** @pixiv/three-vrm
- **State Management:** React Context or Zustand (if needed)

## 3. Core Features

### 3.1 3D Avatar Scene
- Load and display `assets/vrm/Model1.vrm`.
- Orbit controls to view the model.
- Basic idle animation or pose.
- Responsive canvas resizing.

### 3.2 Chat Interface
- Floating or sidebar chat window.
- Message history display (User vs. Bot).
- Input field for user text.
- Integrated with Shadcn UI components (Card, Input, Button, ScrollArea).

### 3.3 Integration
- **Lip Sync (Optional/Future):** Simple mouth movement based on text volume or mock data.
- **Expressions:** Trigger facial expressions based on sentiment (Happy, Sad, Neutral).

## 4. Development Plan

### Phase 1: Project Setup
- Initialize Vite React TypeScript project.
- Setup Tailwind CSS.
- Install Shadcn UI CLI and configure components.
- Install Three.js, R3F, Drei, and three-vrm.

### Phase 2: 3D Scene Implementation
- Create a reusable `Avatar` component.
- Implement VRM loading logic.
- Add lighting and environment.

### Phase 3: UI Implementation
- Create the Chat UI layout using Shadcn.
- Implement message state and input handling.

### Phase 4: Integration
- Connect Chat UI to a mock backend or simple logic.
- Ensure the 3D scene sits nicely alongside the UI (Overlay or Split screen).

## 5. Assets
- **Model Path:** `/assets/vrm/Model1.vrm`
