import type { FlowchartData } from "../types/types";

export type DeckSummary = { id: string; filename: string; page_count: number };
export type DeckDiagram = {
  id: string;
  page_number: number;
  position: number;
  title: string;
  kind: string;
  status: "queued" | "processing" | "awaiting_description" | "ready" | "failed" | "review" | "excluded";
  box?: [number, number, number, number];
  selected?: boolean;
  error: string | null;
  flowchart_id: string | null;
  public_path: string | null;
  graph: FlowchartData | null;
  short_alt?: string | null;
  summary?: string | null;
};
export type DeckResult = DeckSummary & {
  phase?: "detect" | "generate" | "legacy";
  revision?: number;
  job_status: "queued" | "running" | "done" | "failed";
  error: string | null;
  pages: {
    status: "pending" | "done" | "failed";
    count?: number;
    error?: string;
  }[];
  items: DeckDiagram[];
};

export function validateDeckFile(file: File | null): string | null {
  if (!file) return "Choose a PDF slide deck.";
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return "Export your slides as a PDF first.";
  if (file.size > 20 * 1024 * 1024) return "The PDF must be 20 MB or smaller.";
  if (file.size === 0) return "The selected file is empty.";
  return null;
}

export function deckLinksText(deck: DeckResult, origin: string): string {
  return deck.items
    .filter((item) => item.public_path)
    .map(
      (item) =>
        `Slide ${item.page_number} - ${item.title}: ${origin}${item.public_path}`,
    )
    .join("\n");
}
