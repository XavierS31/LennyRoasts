import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { MAX_EXTRACTED_LENGTH, MAX_PDF_PAGES } from "./documentImport";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const loading = getDocument({ data: bytes, useSystemFonts: true });
  // Password prompts are outside this MVP; fail promptly rather than hanging.
  let passwordProtected = false;
  loading.onPassword = () => { passwordProtected = true; void loading.destroy(); };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const extraction = async () => {
      const pdf = await loading.promise;
      if (pdf.numPages > MAX_PDF_PAGES) throw new Error("Choose a PDF with 50 pages or fewer.");
      const pages: string[] = [];
      let length = 0;
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index);
        try {
          const content = await page.getTextContent();
          let text = "";
          let lastY: number | undefined;
          for (const item of content.items) {
            if (!("str" in item)) continue;
            const y = item.transform[5];
            if (text && lastY !== undefined && Math.abs(y - lastY) > 2 && !text.endsWith("\n")) text += "\n";
            text += item.str;
            text += item.hasEOL ? "\n" : " ";
            lastY = y;
          }
          pages.push(text.trim());
          length += text.length;
          if (length > MAX_EXTRACTED_LENGTH) throw new Error("This PDF has too much text to preview. Choose a shorter document or paste the relevant section.");
        } finally {
          page.cleanup();
        }
      }
      return pages.join("\n\n");
    };
    return await Promise.race([
      extraction(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Reading this PDF took too long. Try a smaller file or paste the relevant text.")), 20_000);
      }),
    ]);
  } catch (error) {
    if (passwordProtected) {
      throw new Error("Password-protected PDFs are not supported. Choose an unlocked copy.");
    }
    if (error instanceof Error && /invalid pdf|missing pdf|formaterror/i.test(`${error.name} ${error.message}`)) {
      throw new Error("This PDF could not be read. Try exporting it again or use a Markdown file.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    await loading.destroy();
  }
}
