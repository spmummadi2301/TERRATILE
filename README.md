# TERRATILE — Tactical Real-Time Conquest Engine

> **“THIS MAP BELONGS TO NO ONE...YET”**
> *Until you click.*

TERRATILE is a premium, real-time, Swiss-design inspired territorial strategy game interface designed by architects. It features a warm paper light-mode palette, blueprint grids, precise coordinate overlays, and native Web Audio synthesizers to create a tactile cartographic battlefield.

---

## 📐 Design Aesthetics & Style Guide

TERRATILE is built on the principles of Swiss minimalism, geometric precision, and modern strategic cartography:

*   **Color Tokens (Light Mode)**:
    *   *Base Background*: `#F5F3EE` (Warm paper white)
    *   *Secondary Panels*: `#E7E2D9` (Architectural surface cards)
    *   *Grid Boundaries*: `#D2CCC1` (Blueprint grid lines)
    *   *Primary Charcoal*: `#1F1F1B` (Tactile military text)
    *   *Strategic Operator Auras*: Clay Red (`#B85C38`), Moss Green (`#5E7C5A`), Dust Blue (`#5C7285`), Sand Gold (`#C29B5A`), Burnt Orange (`#C96B3B`), and Slate Purple (`#72637E`).
*   **Typography Hierarchy**:
    *   *Geometric Headings*: `Space Grotesk` (Google Fonts)
    *   *High-Performance Body*: `Inter` (Google Fonts)
*   **Tactility & Feedback**:
    *   *Visual guide rulers*: Absolute cursor crosshair guidelines aligning grid quadrants dynamically.
    *   *Pulsing highlights*: Ripple animations when neighboring tiles are captured.
    *   *Responsive Canvas*: Infinite click-and-drag panning and scroll-wheel zoom mapping GPU transitions.

---

## ⚡ System Features

1.  **40x40 Real-Time Grid Matrix**: Renders 1,600 tiles dynamically. Select and claim tiles directly, or double-click to capture instantly.
2.  **Operator Profile Editor (Your Digital Aura)**: Set custom operator nicknames and select strategic aura colors. Session states are persisted in `localStorage`.
3.  **Live Telemetry Stock Ticker**: Displays a real-time terminal-style stock ticker logs feed of active grid conquest logs.
4.  **Terminal Leaderboard**: Scoreboard lists operators sorted by captured tile scores in descending order.
5.  **Web Audio Synthesizer**: Custom synthesized acoustics (Tactical clicks, paper stamp stamp impact, warning alerts, and a rising victory chime arpeggio) generated programmatically in the browser.
6.  **Conquest Victory Pop-up**: Automatically checks score metrics. Triggers an arpeggiated Victory Modal popup if any operator secures **20 tiles** (for instant testing!) or when all 1,600 tiles are conquered.
7.  **Cloud Bridge Integration**: A built-in connection gateway panel allowing you to point your static Vercel frontend to any local/cloud WebSocket backend on the fly.

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5, Vanilla CSS Grid, JavaScript (ES6+), Web Audio API, HTML5 WebSockets.
*   **Backend Server**: Python 3, `asyncio`, `websockets` (v12+ support).

---

## 💻 Local Quick Start

To run the full architecture locally on your machine:

1.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
2.  **Start the unified server**:
    ```bash
    python server.py
    ```
    *This launches:*
    *   *The HTTP static web server on [http://localhost:5173/](http://localhost:5173/)*
    *   *The WebSocket engine on `ws://localhost:5174`*
3.  **Play**: Open `http://localhost:5173/` in your browser.

---

## ☁️ Cloud Deployment Pipeline

TERRATILE is optimized for standard, zero-config cloud deployments:

### 1. Frontend (Netlify & Vercel)
*   **Netlify Live Production URL**: `https://terratile.netlify.app/`
*   **Vercel Live Production URL**: `https://terratile-git-main-spmummadi2301s-projects.vercel.app/`

### 2. Backend (Render)
*   **Deploy**: Create a Python **Web Service** on Render pointing to your GitHub repo.
*   **Build Command**: `pip install -r requirements.txt`
*   **Start Command**: `python server.py`
*   **Render live WebSocket URL**: `wss://your-render-app-name.onrender.com`

### 3. Sync
Open your live Vercel URL, click **ENTER THE GRID**, scroll down the sidebar to the **SYSTEM BRIDGE** panel, enter your secure Render URL (`wss://...`), and click **RECONNECT GATEWAY**!
