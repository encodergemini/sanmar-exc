# SanMar PDF to Excel Auto-Fill (Netlify App)

Aplikasi web untuk mengonversi file laporan pengujian PDF (Intertek / SanMar) menjadi file Excel terisi berdasarkan `sanmar template.xlsx` dan **Aturan Utama**.

## Struktur Folder
- `public/index.html` — Antarmuka web (drag-and-drop PDF, editor Aturan Utama, & generator Excel client-side via ExcelJS).
- `public/sanmar-template.xlsx` — File template acuan Excel SanMar.
- `netlify/functions/extract.mjs` — Serverless function untuk mengekstrak isi PDF menjadi JSON terstruktur via Gemini API (`gemini-2.5-flash`).
- `netlify.toml` — Konfigurasi build & routing `/api/*` di Netlify.
- `package.json` — Dependensi Node.js (`@google/genai`).

## Cara Deploy ke Netlify
1. Upload seluruh isi folder ini ke repository **GitHub** (atau drag-and-drop via Netlify CLI).
2. Buka [Netlify](https://app.netlify.com) -> **Add new site** -> **Import an existing project** -> pilih repository GitHub Anda.
3. Pada **Environment Variables**, tambahkan:
   - Key: `GEMINI_API_KEY`
   - Value: API Key dari [Google AI Studio](https://aistudio.google.com/apikey)
4. Klik **Deploy site**.
