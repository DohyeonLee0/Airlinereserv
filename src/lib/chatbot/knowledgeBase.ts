import fs from "fs";
import path from "path";

export type KnowledgeChunk = {
  id: string;
  source: string;
  title: string;
  content: string;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "docs", "knowledge");

let cachedChunks: KnowledgeChunk[] | null = null;

function splitMarkdownIntoChunks(source: string, markdown: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentTitle = path.basename(source, ".md");
  let buffer: string[] = [];

  function flush() {
    const body = buffer.join("\n").trim();
    if (!body) return;
    const id = `${source}::${currentTitle}::${chunks.length}`;
    chunks.push({
      id,
      source,
      title: currentTitle,
      content: body
    });
  }

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      currentTitle = heading[1].trim();
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }
  flush();

  if (chunks.length === 0 && markdown.trim()) {
    chunks.push({
      id: `${source}::root`,
      source,
      title: path.basename(source, ".md"),
      content: markdown.trim()
    });
  }

  return chunks;
}

export function loadKnowledgeChunks(): KnowledgeChunk[] {
  if (cachedChunks) return cachedChunks;

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    cachedChunks = [];
    return cachedChunks;
  }

  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .sort();

  cachedChunks = files.flatMap((file) => {
    const fullPath = path.join(KNOWLEDGE_DIR, file);
    const markdown = fs.readFileSync(fullPath, "utf8");
    return splitMarkdownIntoChunks(file, markdown);
  });

  return cachedChunks;
}

/** Clear cache (useful in dev when editing knowledge files). */
export function resetKnowledgeCache() {
  cachedChunks = null;
}

export function formatChunksForPrompt(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "No knowledge base documents found.";
  return chunks
    .map(
      (chunk, index) =>
        `[Source ${index + 1}: ${chunk.source} — ${chunk.title}]\n${chunk.content}`
    )
    .join("\n\n---\n\n");
}
