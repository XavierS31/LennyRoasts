import { MAX_IDEA_LENGTH } from "./ideaSubmission.ts";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const MAX_EXTRACTED_LENGTH = 100_000;

type IdeaFile = Pick<File, "name" | "size" | "arrayBuffer">;

export function documentKind(file: Pick<File, "name" | "size">): "pdf" | "markdown" {
  if (file.size > MAX_FILE_BYTES) throw new Error("Choose a file smaller than 10 MB.");
  if (!file.size) throw new Error("This file is empty. Choose a PDF or Markdown file with text.");
  if (/\.pdf$/i.test(file.name)) return "pdf";
  if (/\.(md|markdown)$/i.test(file.name)) return "markdown";
  throw new Error("Choose a PDF (.pdf) or Markdown (.md or .markdown) file.");
}

// Keep document content as plain text, including Markdown syntax. Never render HTML.
export function cleanDocumentText(text: string): string {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!cleaned) throw new Error("No readable text found. For a scanned PDF, run OCR first or paste your notes.");
  if (cleaned.includes("\0")) throw new Error("This file does not contain readable text. Save Markdown as UTF-8 or choose a text-based PDF.");
  if (Array.from(cleaned).length > MAX_EXTRACTED_LENGTH) {
    throw new Error("This document has too much text to preview. Choose a shorter document or paste the relevant section.");
  }
  return cleaned;
}

export function mergeIdeaText(idea: string, text: string, append: boolean): string {
  const next = append && idea.trim() ? `${idea.trim()}\n\n${text.trim()}` : text.trim();
  if (Array.from(next).length > MAX_IDEA_LENGTH) {
    throw new Error("Use 8,000 characters or fewer. Shorten the extracted text or your existing idea before adding it.");
  }
  if (!next) throw new Error("Keep some extracted text before adding it to your idea.");
  return next;
}

export async function extractIdeaFile(file: IdeaFile): Promise<string> {
  const kind = documentKind(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "markdown") {
    try {
      return cleanDocumentText(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Save your Markdown file as UTF-8 and try again.");
      throw error;
    }
  }
  // The large PDF library and its local worker are loaded only for PDF imports.
  const { extractPdfText } = await import("./pdfImport");
  return cleanDocumentText(await extractPdfText(bytes));
}
