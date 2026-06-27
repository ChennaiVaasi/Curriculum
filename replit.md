# Curriculum

A chess chapter library — upload split PDF chapters to Cloudflare R2, browse them by level/theme, and chat with any chapter through ChatPDF.

## Run & Operate

- Frontend: `artifacts/curriculum` — Vite + React app at `/`
- Backend: `artifacts/api-server` — Express API at `/api`
- Required env secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (optional: `R2_CATALOG_KEY`)
- Without R2: catalog falls back to local `data/catalog.json`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4, wouter routing
- API: Express 5 + multer (file uploads)
- Storage: Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3`
- ChatPDF API (user supplies API key, stored in localStorage)

## Where things live

- `artifacts/curriculum/src/pages/` — page components (Home, Library, Books, Chapters, Notebook, Settings, Upload)
- `artifacts/curriculum/src/components/` — SiteShell, ChapterChat, NotebookClient, UploadForm
- `artifacts/curriculum/src/lib/` — fen.ts (FEN notebook), types.ts, utils.ts
- `artifacts/api-server/src/lib/` — r2.ts, catalog.ts, types.ts, utils.ts
- `artifacts/api-server/src/routes/` — catalog.ts, files.ts, upload.ts, chatpdf.ts

## Architecture decisions

- Catalog is stored in R2 as JSON (`catalog/catalog.json`) when R2 is configured; falls back to local `data/catalog.json` otherwise.
- ChatPDF API keys are never stored server-side — users paste them in the chat panel and they're saved to localStorage only.
- File uploads use multer (memory storage) and are forwarded to R2 immediately.
- FEN notebook is localStorage-only — no server persistence needed.
- The app uses wouter for client-side routing (no hash-based routing).

## Product

- Upload split chess chapter PDFs with metadata (book, level, theme, skills)
- Browse the chapter library by book, filter by level/theme
- Read any chapter in an embedded PDF viewer
- Chat with a chapter via ChatPDF (one chapter at a time)
- Save FEN positions from chat replies to a local notebook, export as PGN

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- R2 credentials must be set as Replit secrets (not .env file) for the API server to pick them up.
- The catalog endpoint (`GET /api/catalog`) also doubles as the R2 health check on the Upload page.
- multer is needed for `POST /api/upload` — it's in `artifacts/api-server` dependencies.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
