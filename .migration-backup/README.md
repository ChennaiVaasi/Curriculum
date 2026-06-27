# Curriculum

Curriculum is a Next.js app for browsing split chess book chapters, uploading chapter PDFs to Cloudflare R2, and talking to a single chapter through ChatPDF.

## Features

- Upload chapter PDFs from the app UI
- Store chapter files in private Cloudflare R2 objects
- Persist the chapter catalog in R2, with a local JSON fallback for development
- Browse books and chapters by level, theme, and skill
- Read each chapter in an embedded PDF viewer
- Send one selected chapter to ChatPDF and ask questions about just that file

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in your R2 values.

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_CATALOG_KEY=catalog/catalog.json
```

## Notes

- ChatPDF API keys are stored in browser local storage, not on the server.
- If R2 is not configured yet, the app falls back to `data/catalog.json` for browsing.
- The PDF reader streams files through the app, so the R2 bucket does not need to be public.
