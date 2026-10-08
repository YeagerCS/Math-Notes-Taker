# Math Notes

A handwriting notebook app for the browser, built for taking math notes on a tablet with a stylus.

- **Library** of notebooks with hardcover-style covers
- **Vertical pages** you can scroll and pinch-zoom, on squared, lined, dotted or blank paper
- **Pressure-sensitive ink**, highlighter, stroke eraser (also via the stylus side button), undo/redo
- **Palm rejection** — the pen writes, fingers only scroll and zoom
- **Autosave** to a small self-hosted backend
- Installable as a **PWA**

## Stack

| | |
| --- | --- |
| Frontend | React, Vite, TypeScript, [perfect-freehand](https://github.com/steveruizok/perfect-freehand) |
| Backend | Node.js, Fastify, PostgreSQL |

## Run locally

```bash
cd backend && cp .env.example .env    # fill in the values
npm install && npm run dev            # http://localhost:3000

cd frontend
npm install && npm run dev            # http://localhost:5173
```

Setup details, deployment and operations notes are in [docs/SETUP.md](docs/SETUP.md).
