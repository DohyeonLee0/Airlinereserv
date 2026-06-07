# Chatbot Knowledge Base

Markdown files in this folder power the **RAG chatbot** (floating assistant on every page).

## How it works

1. Each `.md` file is split into sections by `##` headings.
2. When a user asks a question, the server scores chunks with keyword/TF-IDF retrieval.
3. Top chunks are sent as context to OpenAI (if `OPENAI_API_KEY` is set) or shown directly as excerpts.

## Adding rules

1. Create or edit a `.md` file in this directory.
2. Use `#` for document title and `##` for sections (each section becomes a retrievable chunk).
3. Restart the dev server if running (chunks are cached in memory).

## Files

| File | Topics |
|------|--------|
| `system-overview.md` | App purpose, pages, tech stack |
| `demo-accounts.md` | Login emails and passwords |
| `user-roles.md` | Customer / Staff / Admin / SuperAdmin permissions |
| `booking-rules.md` | How to book, cancel policy, My Bookings |
| `staff-dashboard.md` | Dashboard sections and workflows |

## Environment

```env
OPENAI_API_KEY=sk-...      # optional; enables natural-language answers
OPENAI_MODEL=gpt-4o-mini   # optional; default gpt-4o-mini
```

Without `OPENAI_API_KEY`, the bot still works by returning relevant knowledge excerpts.
