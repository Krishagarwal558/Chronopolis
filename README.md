# Chronopolis

Chronopolis is a top-down detective town simulation built with Phaser 3, Vite, and a Python Flask backend. The player explores a small Tiled town, questions residents, tracks clues in a detective notebook, and follows NPCs as they move through daily routines.

The game is wired for Groq-powered NPC dialogue, but it also works without an API key by using local fallback dialogue.

## Features

- Phaser 3 top-down town exploration
- Vite frontend on port `5173`
- Python Flask simulation backend on port `5000`
- Tiled map loading from `public/assets/maps/chronopolis.tmx`
- Local tileset and character sprites from `public/assets/`
- WASD and arrow-key player movement
- Camera follow
- NPC names shown above characters
- In-game clock starting at `06:00`
- NPC schedules for homes, jobs, school, park, warehouse, and police station
- Collision/pathfinding around buildings and blocked map areas
- Press `E` near an NPC to question them
- Detective notebook with case state, known NPCs, clues, and witness statements
- Groq dialogue support through the backend only
- Fallback dialogue when `GROQ_API_KEY` is missing

## Tech Stack

- Frontend: Vite, Phaser 3, JavaScript
- Backend: Python, Flask, Flask-CORS
- AI dialogue: Groq SDK
- Environment config: `.env`

## Project Structure

```text
.
├── public/
│   └── assets/
│       ├── maps/
│       │   ├── chronopolis.tmx
│       │   └── tilemap_packed.png
│       └── npcs/
│           ├── Generic Male NPCs.png
│           ├── Generic Female NPCs.png
│           └── Generic Children NPCs.png
├── src/
│   ├── main.js
│   ├── entities/
│   │   ├── NPC.js
│   │   └── Player.js
│   ├── scenes/
│   │   ├── PreloadScene.js
│   │   ├── TownScene.js
│   │   └── UIScene.js
│   ├── services/
│   │   └── apiClient.js
│   └── utils/
│       └── spriteFrames.js
├── backend/
│   ├── app.py
│   ├── run_backend.cjs
│   ├── data/
│   │   ├── locations.py
│   │   ├── npcs.py
│   │   └── schedules.py
│   └── simulation/
│       ├── ai_engine.py
│       ├── crime_engine.py
│       ├── dialogue_engine.py
│       ├── npc_engine.py
│       ├── pathfinder.py
│       ├── schedule_engine.py
│       ├── town_state.py
│       └── witness_engine.py
├── .env.example
├── package.json
├── requirements.txt
└── vite.config.js
```

## Setup

Install the JavaScript dependencies:

```bash
npm install
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_key_here
FLASK_PORT=5000
```

The API key belongs only in `.env`. Do not put it in frontend files.

## Running the Game

Start the frontend and backend together:

```bash
npm run dev:full
```

Then open:

```text
http://localhost:5173
```

You can also run each side separately:

```bash
npm run backend
npm run dev
```

## Controls

- Move: `WASD` or arrow keys
- Question nearby NPC: `E`
- Type a question in the interaction box, then submit it

Good questions to try:

```text
Where were you this morning?
Did you notice anything strange?
Who was near the park?
What is your schedule today?
Are you hiding something?
```

## Gameplay

When the game starts, Chronopolis loads the Tiled town map and asks the backend for the current simulation state. The backend controls:

- the in-game clock
- NPC locations
- NPC schedules
- the current missing-person case
- clues and witness statements
- NPC memory, mood, suspicion, and rapport
- Groq or fallback dialogue

The case system chooses one NPC as missing. That means the visible town usually has one fewer NPC than the full cast. Questioning witnesses can reveal clues in the detective notebook.

## NPC Cast

- Mayor
- Tom
- Emma
- Teacher
- Jake
- Sarah
- Officer

NPCs follow schedules throughout the day. They travel between homes, the school, the park, the warehouse, and the police station.

## Groq Dialogue

Groq is called only from the Python backend. The frontend sends the NPC name and player question to the backend, and the backend decides whether to use Groq or fallback dialogue.

If `GROQ_API_KEY` is missing or still set to `your_key_here`, the game will keep working with local fallback dialogue.

When a real key is added, NPC responses become more dynamic. They can refer to:

- current time
- current location
- destination
- job
- mood
- suspicion
- rapport
- known clues
- witness statements
- recent conversation memory

## Backend API

The frontend talks to these endpoints through the Vite proxy:

```text
GET  /api/state
POST /api/tick
POST /api/interact
GET  /api/case
```

Vite proxies `/api` to:

```text
http://127.0.0.1:5000
```

## Troubleshooting

### No NPCs, no clock, or notebook says "No backend state"

The frontend is running, but the backend is not. Start both together:

```bash
npm run dev:full
```

Or start the backend separately:

```bash
npm run backend
```

Then refresh `http://localhost:5173`.

### Groq dialogue is not showing

Check that `.env` exists in the project root and contains:

```env
GROQ_API_KEY=your_real_key_here
FLASK_PORT=5000
```

Restart the backend after editing `.env`.

### Port already in use

The frontend expects port `5173`; the backend expects port `5000`. Stop the old process or change `FLASK_PORT` and update `vite.config.js`.

## Build

Create a production frontend build:

```bash
npm run build
```

Preview the built frontend:

```bash
npm run preview
```

## Notes

All map and sprite assets are loaded from `public/assets/`. The project does not generate or depend on invented asset files.

Chronopolis is currently a playable prototype: exploration, schedules, collision, questioning, notebook updates, and AI-ready dialogue are working. The next big improvements would be better case resolution, richer clue logic, indoor scenes, and more polished NPC behavior.
