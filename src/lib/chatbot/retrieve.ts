import type { KnowledgeChunk } from "@/lib/chatbot/knowledgeBase";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "also",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "it",
  "they",
  "them",
  "their",
  "about",
  "there",
  "here",
  "up",
  "out",
  "over",
  "under",
  "again",
  "further",
  "once"
]);

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const words = normalized
    .replace(/[^\p{L}\p{N}@./_-]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  // Also keep email local-parts and role keywords split from dots
  const extras: string[] = [];
  for (const token of words) {
    if (token.includes("@")) {
      extras.push(token);
      extras.push(token.split("@")[0]);
    }
    if (token.includes(".")) {
      for (const part of token.split(".")) {
        if (part.length > 2) extras.push(part);
      }
    }
  }

  return [...words, ...extras];
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

function buildIdf(chunks: KnowledgeChunk[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const chunk of chunks) {
    const unique = new Set(tokenize(`${chunk.title} ${chunk.content}`));
    for (const token of unique) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  const n = chunks.length;
  const idf = new Map<string, number>();
  for (const [token, df] of docFreq) {
    idf.set(token, Math.log(1 + n / df));
  }
  return idf;
}

function scoreChunk(queryTokens: string[], chunk: KnowledgeChunk, idf: Map<string, number>): number {
  const text = `${chunk.title} ${chunk.content} ${chunk.source.replace(".md", "")}`;
  const tf = termFrequency(tokenize(text));
  let score = 0;

  for (const token of queryTokens) {
    const freq = tf.get(token);
    if (!freq) continue;
    score += freq * (idf.get(token) ?? 0);
  }

  // Boost exact email / role / path matches
  const lower = text.toLowerCase();
  const rawQuery = queryTokens.join(" ");
  if (rawQuery.includes("@") && lower.includes(rawQuery)) score += 5;
  for (const token of queryTokens) {
    if (token.includes("@") && lower.includes(token)) score += 4;
    if (token.startsWith("/") && lower.includes(token)) score += 3;
  }

  return score;
}

export function retrieveRelevantChunks(
  query: string,
  chunks: KnowledgeChunk[],
  topK = 4
): KnowledgeChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || chunks.length === 0) return chunks.slice(0, topK);

  const idf = buildIdf(chunks);
  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(queryTokens, chunk, idf) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return chunks.slice(0, topK);
  }

  return ranked.slice(0, topK).map((item) => item.chunk);
}
