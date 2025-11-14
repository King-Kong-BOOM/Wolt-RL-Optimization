# Wolt RL Optimization Frontend

Frontend application for visualizing and controlling the Wolt RL Optimization simulation.

## Features

- **Graph Visualization**: Real-time graph rendering with React Flow, minimizing edge overlaps and preventing edge-vertex intersections
- **Simulation Controls**: Create new graphs, pause/resume simulation, and train the RL agent
- **State Display**: Dynamic table showing current simulation state (drivers, tasks, rewards, queues, etc.)
- **Performance Charts**: Real-time performance metrics with timestep-based x-axis (paused during training)

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- React Flow for graph visualization
- Recharts for performance charts
- Axios for HTTP requests
- WebSocket for real-time updates

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Backend Integration

The frontend expects a Python Flask backend running on `http://localhost:5000` with:

- WebSocket endpoint: `ws://localhost:5000/ws`
- HTTP API endpoints:
  - `POST /api/simulation/create` - Create new simulation
  - `POST /api/simulation/train` - Train agent
  - `POST /api/simulation/pause` - Pause simulation
  - `POST /api/simulation/resume` - Resume simulation

## Environment Variables

Create a `.env` file in the `frontend/` directory to customize backend URLs:

```
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000/ws
```

## Project Structure

```
frontend/
  src/
    components/
      GraphView/       # Graph visualization components
      Controls/        # Simulation controls and hyperparameters
      StateTable/      # Current state display
      PerformanceCharts/ # Performance metrics charts
    hooks/
      useSimulationAPI.ts  # WebSocket and HTTP API integration
      useGraphLayout.ts    # Graph layout calculations
    utils/
      graphLayout.ts       # Layout algorithms
    App.tsx            # Main app component
    main.tsx           # Entry point
    types.ts           # TypeScript type definitions
```

## Build

```bash
npm run build
```

The built files will be in the `dist/` directory.

