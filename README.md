# F1 Racing Simulator 🏎️

Welcome to my F1 Racing Simulator project!

I've always been a huge fan of Formula 1 and wanted to see how far I could push browser-based graphics and physics. This isn't just a tech demo; it's a labor of love trying to get that "perfect lap" feeling using web technologies.

Built from scratch using **Three.js** for the visuals and **Rapier3D** for the physics engine.

## 🏁 Features

*   **Arcade-Sim Hybrid Physics:** I spent a lot of time tuning the grip and suspension to make it feel snappy but weighty.
*   **Multiplayer Lobby:** Create rooms and race against friends (uses Socket.IO).
*   **Dynamic Camera:** The camera interpolates smoothly and zooms based on speed to give you that sense of acceleration.
*   **Lap Timing System:** Accurate to the millisecond.
*   **Visuals:** Custom shaders for the track and car materials.

## 🎮 Controls

It's pretty standard, but tight:

*   **W / Up Arrow:** Accelerate (Gas)
*   **S / Down Arrow:** Brake / Reverse
*   **A / D / Left / Right:** Steering
*   **C:** Toggle Camera View (Cockpit / Chase)
*   **R:** Reset Car (Use this if you flip over!)

## 🛠️ Tech Stack

*   **Language:** TypeScript (because types save lives)
*   **3D Engine:** Three.js
*   **Physics:** @dimforge/rapier3d-compat (WASM-based, super fast)
*   **Build Tool:** Vite
*   **Multiplayer:** Socket.IO + Express

## 🚀 Installation

If you want to run this locally and mess around with the physics values:

1.  **Clone the repo**
2.  **Install dependencies:**
    ```bash
    npm install
    cd server && npm install
    ```
3.  **Start the Backend (Required for Lobby):**
    ```bash
    # Open a terminal in the root
    cd server
    node index.js
    ```
4.  **Start the Frontend:**
    ```bash
    # Open a second terminal
    npm run dev
    ```
5.  Open `http://localhost:5173` and drive!

## 📝 Dev Notes & Challenges

**Why I built this:**
I wanted to learn how to implement a deterministic game loop in the browser. Syncing the physics steps (fixed delta time) with the render loop (variable delta time) was a fun challenge.

## Release Notes

### v1.1.0 - Multiplayer Update 🏎️
Just pushed a major update! Multiplayer mode is finally live. 
- **Real-time Racing**: You can now race against other players.
- **Sync**: Implemented basic state synchronization for player positions.

It's a big change, so let me know if you spot any weird lag or sync issues!

Enjoy the drive! 🏎️💨
