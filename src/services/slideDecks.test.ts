import { describe, expect, it } from "vitest";
import {
  deckLinksText,
  validateDeckFile,
  type DeckResult,
} from "./slideDecks";

describe("slide decks", () => {
  it("validates file type, emptiness and size before uploading", () => {
    expect(validateDeckFile(null)).toMatch(/Choose/);
    expect(
      validateDeckFile({ name: "slides.pptx", size: 100 } as File),
    ).toMatch(/PDF/);
    expect(validateDeckFile({ name: "slides.pdf", size: 0 } as File)).toMatch(
      /empty/,
    );
    expect(
      validateDeckFile({ name: "slides.pdf", size: 21 * 1024 * 1024 } as File),
    ).toMatch(/20 MB/);
    expect(
      validateDeckFile({ name: "slides.PDF", size: 100 } as File),
    ).toBeNull();
  });

  it("copies only available links, preserving slide order", () => {
    const deck = {
      items: [
        { title: "First", page_number: 1, public_path: "/p/abc" },
        { title: "Pending", page_number: 2, public_path: null },
        { title: "Third", page_number: 3, public_path: "/p/xyz" },
      ],
    } as DeckResult;
    expect(deckLinksText(deck, "https://example.org")).toBe(
      "Slide 1 - First: https://example.org/p/abc\nSlide 3 - Third: https://example.org/p/xyz",
    );
  });
});
