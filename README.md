# Kanban Task Management MVP

A full-stack Kanban task management application built with **React + Vite**, **Node.js + Express**, and **PostgreSQL**.

---

## Features

- **Three-Column Kanban Board**: Strict separation across **To-Do**, **In Progress**, and **Done** with dynamic column task counts.
- **Native HTML5 Drag-and-Drop**: Drag task cards between columns with immediate server persistence via `PATCH /api/tasks/:taskId`.
- **Task Management (CRUD)**: Create tasks with title, description, priority (`low`, `medium`, `high`), due date, and assigned user. Quick assignee selector directly on cards and task deletion (`×`).
- **Priority Filtering**: Filter board tasks by `All`, `Low`, `Medium`, and `High` using the backend API.
- **Team Members & Workload Balancing**:
  - Displays project members with custom color avatars and in-progress task counts.
  - **Server-Authoritative Burnout Warning**: When a user has more than 5 In Progress tasks (`inProgressTaskCount > 5`), their avatar prominently pulses red with an overload warning badge.
  - Adding team members to projects with duplicate membership prevention.
- **Server-Side Validation**: Robust HTTP status codes (`400`, `404`, `409`, `500`) with parameterized PostgreSQL queries (no ORM).

---

## Project Structure

```
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # KanbanColumn, TaskCard, TaskModal, TeamList
│   │   ├── api.js          # REST API helper
│   │   ├── App.jsx         # Main application component
│   │   ├── App.css         # Styling, dark theme, and pulse-red animations
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                 # Express + PostgreSQL backend
│   ├── src/
│   │   ├── db.js           # pg Pool helper
│   │   ├── routes.js       # REST API endpoints & business logic
│   │   ├── create-db.js    # Database creation script
│   │   ├── init-db.js      # Schema & seed migration runner
│   │   └── index.js        # Express app entry point
│   ├── schema.sql          # PostgreSQL schema & seed data
│   ├── package.json
│   └── .env.example
├── package.json            # Root workspace scripts
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL server running locally (e.g. `postgresql://postgres:postgres@localhost:5432/taskmanager`)

---

### 1. Database Setup

1. Copy `.env.example` in `server/` to `server/.env` and verify your connection string:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmanager
   CLIENT_ORIGIN=http://localhost:5173
   ```
2. Initialize and seed the database:
   ```bash
   cd server
   node src/create-db.js
   node src/init-db.js
   ```

---

### 2. Running the Application

You can start both services from the root or within their respective folders:

#### Option A: From root directory
```bash
# Terminal 1: Start Express backend
npm run server

# Terminal 2: Start Vite frontend
npm run client
```

#### Option B: From subdirectories
```bash
# Backend (http://localhost:5000)
cd server
npm run dev

# Frontend (http://localhost:5173)
cd client
npm run dev
```

---

### 3. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint |
| `GET` | `/api/projects/:id/board` | Get complete board data (supports `?priority=low\|medium\|high`) |
| `POST` | `/api/projects/:id/tasks` | Create task |
| `PATCH` | `/api/tasks/:id` | Update task (status, priority, assignee, due date) |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `GET` | `/api/projects/:id/users` | List project members |
| `POST` | `/api/projects/:id/users` | Add user to project |
| `GET` | `/api/users` | List all system users |
| `GET` | `/api/projects` | List projects |
