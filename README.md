# DocScan — ML Document Scanner

An in-browser document scanner using OpenCV.js (WebAssembly). Detects document edges, draws an outline overlay, and applies perspective correction — all client-side, no backend needed.

## Features
- 📷 Live camera with real-time edge detection overlay
- 🖼 File upload (JPG, PNG, WebP) with document outline
- 📐 Perspective warp — flattens tilted documents
- 📊 Detection metrics (size, frame coverage, corners)
- 💾 Download scanned result

## Deploy to Vercel (2 minutes)

### Option A — Vercel CLI
```bash
npm i -g vercel
cd doc-scanner
vercel
```
Follow the prompts. Done — you'll get a live URL.

### Option B — Vercel Dashboard (no CLI)
1. Zip this folder and go to [vercel.com/new](https://vercel.com/new)
2. Drag & drop the zip, or push to GitHub first and import the repo
3. No build settings needed — it's static HTML
4. Click **Deploy**

## Local development
```bash
# Any static server works:
npx serve .
# or
python3 -m http.server 8080
```
Then open http://localhost:8080

## Extend it
- Add **Tesseract.js** for OCR text extraction after scanning
- Connect a **Python/FastAPI** backend with OpenCV + YOLOv8 for multi-doc detection
- Add **PDF.js** to support scanning pages from uploaded PDFs
