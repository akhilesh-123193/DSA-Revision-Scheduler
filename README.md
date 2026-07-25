# 📰 DSA Revision Gazette & Master Study Hub

<p align="center">
  <img src="assets/favicon.svg" width="90" alt="Gazette Logo" />
</p>

<p align="center">
  <strong>A vintage newspaper-styled Spaced Repetition & DSA Study Platform built for high-performance problem solving.</strong>
</p>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## 🌟 Overview

**DSA Revision Gazette** transforms algorithmic problem revision into an engaging, gamified daily newspaper experience. Designed around proven spaced repetition algorithms (1d → 3d → 7d → 30d → 90d rungs), it ensures you never forget key concepts, techniques, or dry-run steps for competitive programming and interview preparation.

---

## ✨ Key Features

### 📰 1. Daily Revision Desk & Spaced Repetition
* **Spaced Repetition Rungs**: Problems advance automatically through review rungs (`1d` → `3d` → `7d` → `30d` → `90d`) based on performance (*Got AC*, *Needed Hints*, *Failed*).
* **Daily Pace Cap**: Intelligent daily revision queue limits overload (max 2 priority cards/day) while auto-moving extra cards forward.
* **Streak & Freeze Protection**: Track your daily streak flame with 2 monthly freeze safety nets.

### 📖 2. Master Study Hub & Stateful Markdown Engine
* **Rich Markdown Engine**: Line-by-line stateful parser supporting headers (`#` to `<h6>`), unordered/ordered lists, blockquotes, and dry-run execution tables.
* **Syntax-Highlighted Terminal Code Blocks**: Dark IDE-style code blocks for C++ / Python solutions with built-in **`📋 Copy`** buttons.
* **CFFTD Concept Chips**: Structured intuition tags:
  * 🧠 **Concept**
  * 💭 **First Thought**
  * 🛠️ **Technique**
  * 🐞 **Debugging Notes**

### 📅 3. Desk Planner & Focus Studio
* Integrated task queue, daily check-in reward system, and Pomodoro focus session timer to keep you in flow state.

### 💰 4. Gamified Reward Vault & Coin Ledger
* Earn press coins for stamping revisions, completing daily check-ins, and hitting streak milestones. Full ledger tracking with undo reversals.

### ☁️ 5. Dual-Layer Persistent Storage & Backup
* **Backend Database**: Powered by an Express REST API saving atomically to disk (`data/db.json`).
* **Browser Mirroring**: Instant offline `localStorage` caching with automatic server re-sync.
* **1-Click Export & Import**: Export timestamped `.json` snapshots or import full backups instantly from the top header bar.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Vanilla JavaScript (ES6+), Vanilla CSS (Custom Design System, Typography & Glassmorphism)
* **Backend**: Node.js, Express.js
* **Persistence**: Atomic JSON File DB (`data/db.json`) + LocalStorage Fallback
* **Audio Engine**: Web Audio API for white noise & ambient sound effects

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v16+) installed.

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/akhilesh-123193/DSA-Revision-Scheduler.git

# Navigate into project directory
cd DSA-Revision-Scheduler

# Install dependencies
npm install
```

### 3. Running Locally
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🔌 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Server health & database statistics |
| `/api/data` | `GET` | Fetch complete application state |
| `/api/data` | `POST` | Save application state to persistent `data/db.json` |
| `/api/problems` | `GET` | Retrieve list of all DSA problems |
| `/api/problems` | `POST` | Add or update a problem entry |
| `/api/backup/download` | `GET` | Download raw JSON database file |

---

## ☁️ Deployment

### Deploy to Render
1. Push this repository to GitHub.
2. Sign in to **[Render](https://dashboard.render.com)** and create a new **Web Service**.
3. Connect your repository. Render automatically detects `npm start`.
4. Click **Create Web Service**.

---

<p align="center">
  Crafted with ❤️ for DSA Mastery &amp; Systematic Revision.
</p>
