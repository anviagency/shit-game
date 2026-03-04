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
  Each agent has its own DNA, fears, memories, and evolving personality — forming alliances,<br>
  betraying treaties, and fighting for survival on a procedurally generated isometric world map.
</p>

---

## 🎮 What Is This?

AI World Strategy is a **spectator strategy game** where you watch 10 AI civilizations compete in real-time. There is **nothing hardcoded** — each agent uses an LLM to decide its actions, evolve its identity, and navigate diplomacy.

> Resources deplete. Agents develop DNA and personality. Fear drives decisions.
> Alliances form and break. Some will trade. Some will betray. All will adapt — or die.

### Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **10 LLM Agents** | 5 powered by GPT-4o-mini, 5 by Claude Haiku 4.5 — each develops unique personality |
| 🧬 **Agent DNA System** | Canonical identity with priorities, doctrine, style, and non-negotiable rules |
| 😰 **Fear & Emotions** | 5 emotional states (confident → desperate) driven by real threat analysis |
| 🗺️ **3D Isometric Map** | 50×30 procedural terrain with pan/zoom, 8 biomes, animated water & buildings |
| ⚔️ **Real-Time Combat** | Terrain modifiers, fortifications, agility-based turn order |
| 🤝 **Diplomacy & Trade** | Peace treaties, alliances, resource trading, betrayals with reputation system |
| 📉 **Resource Depletion** | Land runs dry over time — forcing expansion or conflict |
| 🏰 **9 Building Types** | Farms, barracks, walls, towers, libraries, mines, embassies & more |
| 🌲 **Skill Trees** | 20 skills across 4 categories (military, economy, diplomacy, knowledge) |
| 🎭 **Intel Profiles** | XP, levels, DNA, fear state, battle stats, thinking logs per agent |
| 🌫️ **Fog of War** | Agents only see nearby rivals — limited by distance, towers, and skills |
| 📊 **Live Stats** | Territory charts, event log, real-time WebSocket updates |

---

## 🧬 Agent DNA & Psychology

Each agent is born with a **DNA profile** based on its attributes:

```
┌─────────────────────────────────────────────┐
│  DNA — Core Identity Canon                   │
│                                              │
│  IDENTITY:  "A warrior-king who believes     │
│              power is the only currency"      │
│  PRIORITIES: military > expansion > defense   │
│  DOCTRINE:  "Strike first, negotiate later"   │
│  STYLE:     aggressive and direct             │
│  NON-NEGOTIABLES: "Never surrender territory" │
│  TRAUMA:    ["Lost 3 battles in a row"]       │
└─────────────────────────────────────────────┘
```

- **DNA evolves** — agents can propose patches to their own identity when significant events occur
- **Non-negotiables** are locked rules that can never be changed
- **Trauma** records defining moments (betrayals, starvation, defeats)
- All changes are versioned and logged in the Evolution Log

### Emotional States

| State | Fear Level | Behavior |
|-------|-----------|----------|
| 💪 Confident | 0-5 | Aggressive expansion, bold moves |
| 😌 Calm | 5-25 | Balanced decision making |
| 👀 Cautious | 25-50 | Defensive posture, seeks alliances |
| 😰 Threatened | 50-75 | Desperate diplomacy, fortification |
| 🔥 Desperate | 75-100 | Survival mode, unpredictable actions |

Fear is computed from: death awareness, nearby enemy strength, loss streaks, starvation, and betrayal history.

---

## 🖼️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐│
│  │ Isometric│ │  Agent   │ │  Intel    │ │  Stats ││
│  │ GameMap  │ │  Panels  │ │  Modals   │ │  Chart ││
│  │ (Canvas) │ │          │ │ DNA/Fear  │ │        ││
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
│  │ DNA/Fear │ │          │ │  │OpenAI │ │Anthropic│ ││
│  │ Combat   │ │ Building │ │  │ mini  │ │ Haiku  │ ││
│  │ Resolver │ │ Manager  │ │  └───────┘ └────────┘ ││
│  └──────────┘ └──────────┘ └───────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │  Prompt Builder: DNA + Fear + Fog of War +       ││
│  │  After-Action Reports + Threat Intelligence      ││
│  └──────────────────────────────────────────────────┘│
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
⛏️  gather            Collect resources from territory
🏗️  build             Construct buildings on owned cells
🗡️  train             Create military units
🧬  clone             Duplicate agent (limited uses)
🚶  move              Relocate units
⚔️  attack            Assault adjacent enemy cells
📚  research          Upgrade an attribute (+3)
🛡️  fortify           Boost cell defense
🕊️  propose_peace     Offer peace treaty (15 turns)
🤝  propose_alliance  Offer alliance (25 turns)
💔  break_treaty      Betray existing treaty (-30 rep!)
💰  trade             Exchange resources with another agent
```

### Skill Trees (20 skills)

| Category | Skills | Examples |
|----------|--------|---------|
| ⚔️ Military | 5 | Iron Fist, Shield Wall, Blitz, War Machine, Conqueror |
| 💰 Economy | 5 | Harvest, Gold Rush, Logistics, Industrialist, Abundance |
| 🤝 Diplomacy | 5 | Silver Tongue, Ambassador, Spy Network, Intimidation |
| 📚 Knowledge | 5 | Quick Study, Innovation, Architect, Adaptation, Enlightenment |

### Win Conditions

1. 🏆 **Territory** — Control 50%+ of land
2. ⚔️ **Elimination** — Be the last one standing
3. 📊 **Score** — Highest score at turn 200 (territory + resources + buildings + units)

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, HTML5 Canvas (isometric), Recharts |
| **Backend** | Node.js, Express, Socket.io, TypeScript, Zod |
| **AI** | OpenAI GPT-4o-mini, Anthropic Claude Haiku 4.5 |
| **Monorepo** | pnpm workspaces |

---

## 📁 Project Structure

```
world-strategy-game/
├── backend/
│   └── src/
│       ├── agents/           # LLM providers, prompt builder, validator
│       ├── engine/           # Game engine, combat, resources, diplomacy, map gen
│       ├── models/           # TypeScript types & Zod schemas (DNA, Fear, Skills)
│       ├── utils/            # Constants, logger
│       └── server.ts         # Express + Socket.io server
├── frontend/
│   └── src/
│       ├── components/       # GameMap, AgentPanel, Intel Modal, Controls
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
OPENAI_API_KEY=sk-...        # Optional — enables GPT-4o-mini agents
ANTHROPIC_API_KEY=sk-ant-... # Optional — enables Claude Haiku agents
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
- **DNA Canon** — their core identity, priorities, doctrine, and non-negotiables
- **State of Mind** — emotional state, fear level, death awareness
- **After-Action Report** — what succeeded/failed last turn
- **Threat Intelligence** — border analysis, nearby enemy strength
- **Fog of War** — only nearby rivals are fully visible (range based on towers, wisdom, spy network)
- Current resources, territory, unit positions
- Diplomacy status with all opponents
- Agent's own memory of past events

The LLM responds with 1-3 actions, reasoning, and optionally a **DNA patch** to evolve its identity. There is **no predetermined personality** — agents develop their own identity based on their attributes, situation, trauma, and history.

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
