# OmniX AI — Scientific Research Assistant

> AI-powered platform that generates evidence-backed solutions to scientific and engineering problems by analyzing arXiv research papers through a RAG pipeline.

![OmniX AI](https://img.shields.io/badge/OmniX-AI-6378ff?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-3.1_Flash-4285F4?style=flat-square)

---

## 🔬 What It Does

1. **You describe a scientific problem** — e.g., "cheaper catalyst for green hydrogen production"
2. **AI expands your query** into 6-8 targeted arXiv search terms
3. **arXiv papers are fetched** — metadata + PDFs downloaded automatically
4. **PDFs are extracted & chunked** using PyMuPDF, cleaned and split into ~500-word segments
5. **Embeddings generated** via Google "text-embedding-004", stored in Supabase pgvector
6. **Semantic retrieval** finds the most relevant paper chunks for your query
7. **Gemini generates 2-3 structured solutions** with citations, feasibility scores, implementation roadmaps
8. **AI chat assistant** answers follow-up questions with full paper context

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Framer Motion |
| Backend | FastAPI, Python 3.12, async architecture |
| Database | Supabase PostgreSQL + pgvector |
| AI | Google Gemini 3.1 Flash + text-embedding-004 |
| Papers | arXiv API + PyMuPDF PDF extraction |
| Auth | Supabase Auth (Email + Google OAuth) |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 22+
- Python 3.12+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Google AI Studio](https://aistudio.google.com) Gemini API key

### 1. Clone & Setup

`ash
git clone https://github.com/yourname/omnix-ai
cd omnix-ai
`

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire contents of "backend/supabase_schema.sql"
3. Enable **pgvector** extension (it's in the schema SQL)
4. Go to **Authentication → Providers** and enable Google OAuth if desired
5. Create a storage bucket named "omnix-papers" (optional, for PDF storage)

### 3. Backend Setup

`ash
cd backend
cp .env.example .env
# Fill in your values in .env

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
`

### 4. Frontend Setup

`ash
cd frontend
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key

npm install
npm run dev
`

Visit "http://localhost:3000"

---

## 🔑 Environment Variables

### Backend ("backend/.env")
`env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
EMBEDDING_MODEL=models/text-embedding-004
GENERATION_MODEL=gemini-3.1-flash
ALLOWED_ORIGINS=http://localhost:3000
`

### Frontend ("frontend/.env.local")
`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
`

---

## 🗂️ Project Structure

`
omnix-ai/
├── frontend/                    # Next.js 15 App
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── research/[sessionId]/
│   │   │   ├── page.tsx         # Research progress + results
│   │   │   └── solution/[solutionId]/page.tsx  # Detailed solution + chat
│   │   ├── dashboard/page.tsx   # User dashboard
│   │   └── (auth)/login|signup/ # Auth pages
│   ├── lib/api/client.ts        # Typed API client
│   └── lib/supabase/            # Supabase clients (browser + server)
│
└── backend/
    ├── app/
    │   ├── main.py              # FastAPI app
    │   ├── config.py            # Settings
    │   ├── routes/              # research.py, solutions.py, chat.py
    │   ├── ai/                  # gemini_client.py, prompts.py, rag_pipeline.py
    │   ├── embeddings/          # embedding_service.py, vector_store.py
    │   ├── parsers/             # pdf_parser.py, text_cleaner.py (chunker)
    │   ├── services/            # arxiv_service.py
    │   ├── background_tasks/    # paper_processor.py
    │   └── utils/               # dependencies.py
    └── supabase_schema.sql      # Full DB schema with pgvector + RLS
`

---

## 🚀 Deployment

### Frontend → Vercel
`ash
cd frontend
npx vercel --prod
`
Set environment variables in Vercel dashboard.

### Backend → Railway / Render
1. Connect your GitHub repo
2. Set root directory to "backend/"
3. Add all environment variables
4. Deploy command: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"

### Docker Compose (local)
`ash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in both .env files
docker-compose up --build
`

---

## ⚠️ Important Disclaimers

- OmniX AI is an **AI-assisted scientific reasoning platform** — not a replacement for domain experts
- All AI-generated solutions are **hypotheses based on academic literature**
- Outputs marked "[HYPOTHESIS]" are speculative extensions beyond direct evidence
- Always verify suggestions with qualified researchers before implementation
- Confidence scores reflect evidence quality, not scientific certainty

---

## 📈 Pipeline Architecture

`
User Query
    ↓
Gemini: Query Expansion (6-8 arXiv search terms)
    ↓
arXiv API: Fetch paper metadata (deduplicated)
    ↓
arXiv: Download PDFs → Supabase Storage
    ↓
PyMuPDF: Extract + clean text (sections, equations)
    ↓
TextChunker: 500-word chunks, 50-word overlap
    ↓
text-embedding-004: 768-dim embeddings → pgvector
    ↓
Cosine Similarity Search: Top-25 relevant chunks
    ↓
Gemini 3.1 Flash: Generate 2-3 structured solutions
    ↓
Store in Supabase → Return to frontend
`

---

## 🤝 Contributing

PRs welcome! Please open an issue first for major changes.

## 📄 License

MIT License — see LICENSE file.
