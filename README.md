<p align="center">
  <img src="https://img.shields.io/badge/AI-World%20Strategy-blueviolet?style=for-the-badge&logo=openai&logoColor=white" alt="AI World Strategy" />
  <img src="https://img.shields.io/badge/Agents-10%20Civilizations-ff6b6b?style=for-the-badge&logo=robot&logoColor=white" alt="10 Agents" />
  <img src="https://img.shields.io/badge/Map-50x30%20Isometric-22c55e?style=for-the-badge&logo=map&logoColor=white" alt="50x30 Map" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">
  <br>
  🌍 AI World Strategy
  <br>
  <sub>10 AI Civilizations. 1 World. No Rules.</sub>
</h1>

<p align="center">
  <b>A real-time strategy game where LLM-powered AI agents compete for world domination.</b><br>
  Each agent develops its own personality, forms alliances, betrays treaties, and fights for survival<br>
  on a procedurally generated isometric world map — all driven by GPT-4o and Claude Sonnet 4.
</p>

---

## 🎮 What Is This?

AI World Strategy is a **spectator strategy game** where you watch 10 AI civilizations compete in real-time. There is **nothing hardcoded** — each agent uses an LLM to decide its actions, develop its personality, and navigate diplomacy.

> Resources deplete. Agents develop their own personality. Alliances form and break.
> Some will trade. Some will betray. All will adapt.

### Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **10 LLM Agents** | 5 powered by GPT-4o, 5 by Claude Sonnet 4 — each develops unique personality |
| 🗺️ **Isometric World Map** | 50×30 procedural terrain with 8 biomes, animated water, trees, buildings |
| ⚔️ **Real-Time Combat** | Terrain modifiers, fortifications, agility-based turn order |
| 🤝 **Diplomacy & Coalitions** | Peace treaties, alliances, betrayals with reputation system |
| 📉 **Resource Depletion** | Land runs dry over time — forcing expansion or conflict |
| 🏰 **9 Building Types** | Farms, barracks, walls, towers, libraries, mines, embassies & more |
| 🎭 **RPG Agent Profiles** | XP, levels, kills, battle stats, thinking logs per agent |
| 🔍 **Click-to-Inspect** | Click any tile or agent for detailed info modal |
| 📊 **Live Stats** | Territory charts, event log, real-time WebSocket updates |

---

## 🖼️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐│
│  │ Isometric│ │  Agent   │ │  RPG      │ │  Stats ││
│  │ GameMap  │ │  Panels  │ │  Modals   │ │  Chart ││
│  │ (Canvas) │ │          │ │           │ │        ││
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘│
│       └─────────────┴─────────────┴───────────┘     │
│                    Socket.io Client                   │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket
┌──────────────────────┴──────────────────────────────┐
│                   Backend (Node.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────────┐│
│  │  Game    │ │ Resource │ │    Agent Manager       ││
│  │  Engine  │ │ Manager  │ │  ┌───────┐ ┌────────┐ ││
│  │          │ │          │ │  │OpenAI │ │Anthropic│ ││
│  │ Combat   │ │ Building │ │  │GPT-4o │ │Claude 4│ ││
│  │ Resolver │ │ Manager  │ │  └───────┘ └────────┘ ││
│  └──────────┘ └──────────┘ └───────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **pnpm** (`npm install -g pnpm`)
- API keys for [OpenAI](https://platform.openai.com/) and/or [Anthropic](https://console.anthropic.com/) *(optional — runs with smart mock AI without keys)*

### Installation

```bash
# Clone the repo
git clone https://github.com/anviagency/shit-game.git
cd shit-game

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env and add your API keys (optional)
```

### Running

```bash
# Terminal 1 — Start backend
cd backend && pnpm dev

# Terminal 2 — Start frontend
cd frontend && pnpm dev
```

Open **http://localhost:5173** and click **Start Game**.

---

## 🎯 Game Mechanics

### Terrain Types

| Terrain | Resources | Height | Special |
|---------|-----------|--------|---------|
| 🌾 Plains | Balanced | Low | Best for farms |
| 🌲 Forest | Wood-rich | Medium | Lumber mills |
| ⛰️ Mountains | Iron-rich | High | Mines, defensive bonus |
| 🌊 Water | None | Lowest | Impassable |
| 🏜️ Desert | Scarce | Low | Harsh conditions |
| ❄️ Tundra | Limited | Medium-High | Cold terrain |
| 🌴 Jungle | Wood-rich | Medium | Dense vegetation |
| 🪷 Swamp | Limited | Low | Difficult terrain |

### Agent Actions (1-3 per turn)

```
⛏️  gather          Collect resources from territory
🏗️  build           Construct buildings on owned cells
🗡️  train           Create military units
🧬  clone           Duplicate agent (limited uses)
🚶  move            Relocate units
⚔️  attack          Assault adjacent enemy cells
📚  research        Upgrade an attribute (+3)
🛡️  fortify         Boost cell defense
🕊️  propose_peace   Offer peace treaty (15 turns)
🤝  propose_alliance  Offer alliance (25 turns)
💔  break_treaty    Betray existing treaty (-30 rep!)
```

### RPG System

- **XP & Levels** — Agents earn XP for every action, level up with random attribute bonuses
- **Reputation** — 0 (treacherous) to 100 (trustworthy), affects diplomacy success
- **Battle Stats** — Kills, wins, losses tracked per agent
- **Thinking Logs** — See what each AI was thinking each turn

### Win Conditions

1. 🏆 **Territory** — Control 50%+ of land
2. ⚔️ **Elimination** — Be the last one standing
3. 📊 **Score** — Highest score at turn 300 (territory + resources + buildings + units)

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, HTML5 Canvas (isometric), Recharts |
| **Backend** | Node.js, Express, Socket.io, TypeScript, Zod |
| **AI** | OpenAI GPT-4o, Anthropic Claude Sonnet 4 |
| **Monorepo** | pnpm workspaces |

---

## 📁 Project Structure

```
world-strategy-game/
├── backend/
│   └── src/
│       ├── agents/           # LLM providers, prompt builder, validator
│       ├── engine/           # Game engine, combat, resources, map gen
│       ├── models/           # TypeScript types & Zod schemas
│       ├── utils/            # Constants, logger
│       └── server.ts         # Express + Socket.io server
├── frontend/
│   └── src/
│       ├── components/       # GameMap, AgentPanel, Modals, Controls
│       ├── hooks/            # useGameSocket, useGameState
│       └── types/            # Frontend type definitions
├── .env.example
├── package.json              # Root monorepo config
└── pnpm-workspace.yaml
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
OPENAI_API_KEY=sk-...        # Optional — enables GPT-4o agents
ANTHROPIC_API_KEY=sk-ant-... # Optional — enables Claude agents
PORT=3001                     # Backend port
GAME_SPEED_MS=2000           # Turn delay in ms
```

### Speed Controls

| Speed | Delay |
|-------|-------|
| 0.5x | 4000ms |
| 1x | 2000ms |
| 2x | 1000ms |
| 5x | 400ms |
| 10x | 200ms |
| 20x | 100ms |

---

## 🧠 How AI Agents Work

Each turn, every alive agent receives a prompt with:
- Current resources, territory, unit positions
- Adjacent cells (neutral + enemy)
- Diplomacy status with all opponents (including their alliances)
- Agent's own memory of past events
- Resource depletion warnings

The LLM responds with 1-3 actions and a `personality_note` that evolves over time. There is **no predetermined personality** — agents develop their own identity based on their attributes, situation, and history.

**Without API keys**, the game runs with a smart mock AI that uses attribute-driven emergent behavior:
- High STR → aggressive military expansion
- High CHA → diplomatic coalition builder
- High ENG → defensive fortifier
- High WIS → knowledge seeker
- Under pressure → seeks peace treaties

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Author

**Built by [Slava Melandovich](https://www.linkedin.com/in/slava-melandovich/)**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/slava-melandovich/)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/slava_melandovich/)
[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/slava.melandovich)
[![Email](https://img.shields.io/badge/Email-slava@uanvi.com-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:slava@uanvi.com)

---

<p align="center">
  <sub>Built with ❤️ and AI • 10 civilizations, 1 world, infinite possibilities</sub>
</p>
