# PDF Studio - Architecture

## Overview

PDF Studio is a client-side PDF utility platform.

Core principles:

* No backend
* No file uploads
* All processing happens in the browser
* Heavy processing runs in Web Workers
* Performance-first architecture

---

# High Level Flow

UI
↓
React Hooks
↓
pdfWorkerClient
↓
pdf.worker.js
↓
Handlers
↓
pdf-lib / Image Processing
↓
Result (PDF Download)

---

# Technology Stack

Frontend:

* React
* Vite
* Tailwind CSS

PDF Processing:

* pdf-lib

Image Processing:

* Canvas API
* OffscreenCanvas
* ImageData

Performance:

* Web Workers
* Transferable ArrayBuffers
* Lazy Loading

---

# Project Structure

src/

components/
Reusable UI components

pages/
Feature pages and testing pages

hooks/
React hooks for PDF operations

utils/
Helpers and worker client

workers/
PDF and image processing logic

styles/
Global styling

---

# Worker Architecture

The worker is the core processing engine.

Main thread never performs heavy PDF operations.

Flow:

Main Thread
↓
ArrayBuffer
↓
Transferable PostMessage
↓
Worker
↓
Process
↓
Uint8Array
↓
Main Thread
↓
Download

Benefits:

* No UI freezing
* Better scalability
* Faster user experience

---

# Merge PDF Flow

User selects PDFs
↓
usePdfMerge
↓
pdfWorkerClient.mergePdfFiles()
↓
pdf.worker.js
↓
mergePdfs.js
↓
pdf-lib
↓
Merged PDF

Status:
Production tested.

---

# Image To PDF Flow

User selects images
↓
useImageToPdf
↓
imageFilesToPdf()
↓
pdf.worker.js
↓
imageToPdf.js
↓
pdf-lib
↓
A4 PDF

Features:

* JPG
* PNG
* WEBP
* Sequential processing
* A4 output

Status:
Production tested.

---

# Notes Cleaner Flow

User selects note photos
↓
useNotesCleaner
↓
notesCleanerFilesToPdf()
↓
pdf.worker.js
↓
notesCleaner.js
↓
reduceShadows()
↓
enhanceContrast()
↓
pdf-lib
↓
A4 PDF

Current Status:

Stage 1 implemented.

Features:

* Shadow reduction
* Contrast enhancement
* A4 export

Known Issue:
Worker synchronization race.

FINISH can execute before APPEND completes.

---

# Future Features

Notes Cleaner Stage 2

* Document boundary detection
* Perspective correction

PDF Compression

* Research pending

UI Redesign

* Planned after core features stabilize

---

# Performance Decisions

* Client-side processing only
* Transferable buffers
* Sequential image processing
* Worker-first architecture
* Minimal dependencies

OpenCV.js intentionally avoided in V1 to keep bundle size small and startup fast.
