// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import axe from "axe-core";
import DeckCropReview, { adjustBox } from "./DeckCropReview";
import { apiFetch } from "../../lib/api";
import type { DeckResult } from "../../services/slideDecks";

vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
const deck: DeckResult = { id: "deck", filename: "test.pdf", page_count: 2, phase: "detect", revision: 0,
  job_status: "done", error: null, pages: [{ status: "done", count: 1 }, { status: "done", count: 0 }],
  items: [{ id: "a", page_number: 1, position: 1, title: "Protein", kind: "biology", status: "review", box: [100, 100, 900, 900],
    selected: true, error: null, flowchart_id: null, public_path: null, graph: null }],
};
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("moves and resizes within slide boundaries", () => {
  expect(adjustBox([100, 100, 900, 900], "move", 500, -500)).toEqual([0, 200, 800, 1000]);
  expect(adjustBox([100, 100, 900, 900], "nw", 1000, 1000)).toEqual([895, 895, 900, 900]);
  expect(adjustBox([100, 100, 900, 900], "se", 200, 200)).toEqual([100, 100, 1000, 1000]);
});

it("resizes a crop, excludes it, and adds a missing diagram before generating", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ image_data_url: "data:image/png;base64,eA==" });
  const saved = vi.fn();
  const { container } = render(<DeckCropReview deck={deck} onSaved={saved} />);
  await screen.findByRole("img");
  const first = within(screen.getByRole("group", { name: "Diagram 1" }));
  expect(screen.queryByRole("spinbutton")).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: /Move diagram 1/ }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Resize top of diagram 1" }), { key: "ArrowUp" });
  fireEvent.click(first.getByLabelText("Include diagram 1"));
  expect((screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
  await screen.findByRole("img", { name: /Full slide 2/ });
  fireEvent.click(screen.getByRole("button", { name: "Add diagram" }));
  fireEvent.click(screen.getByRole("button", { name: "Add centered box instead" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Missing diagram" } });
  fireEvent.keyDown(screen.getByRole("button", { name: /Move diagram 1/ }), { key: "ArrowRight" });
  expect((screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
  await screen.findByRole("img", { name: /Full slide 1/ });
  expect((screen.getByLabelText("Include diagram 1") as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText("Slide"), { target: { value: "2" } });
  await screen.findByRole("img", { name: /Full slide 2/ });
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Missing diagram");
  const report = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(report.violations).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Generate descriptions" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = vi.mocked(apiFetch).mock.calls.find(([path]) => path.endsWith("/review"))!;
  const body = JSON.parse(call[1]!.body as string);
  expect(body.generate).toBe(true);
  expect(body.items[0]).toMatchObject({ id: "a", selected: false, box: [95, 100, 900, 900] });
  expect(body.items[1]).toMatchObject({ page_number: 2, title: "Missing diagram", selected: true, box: [250, 255, 750, 755] });
});

it("keeps edits when saving fails", async () => {
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path.endsWith("/review")) throw new Error("Please reload this review.");
    return { image_data_url: "data:image/png;base64,eA==" };
  });
  const saved = vi.fn();
  render(<DeckCropReview deck={deck} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited title" } });
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Please reload this review.");
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Edited title");
  expect(saved).not.toHaveBeenCalled();
});

it("keeps drawing mode stable until the pointer is released", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.mocked(apiFetch).mockResolvedValue({ image_data_url: "data:image/png;base64,eA==" });
  const { container } = render(<DeckCropReview deck={deck} onSaved={vi.fn()} />);
  await screen.findByRole("img");
  const canvas = container.querySelector(".crop-canvas") as HTMLDivElement;
  canvas.setPointerCapture = vi.fn();
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1000, height: 500 } as DOMRect);
  fireEvent.click(screen.getByRole("button", { name: "Add diagram" }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 50 });
  expect(screen.getByRole("button", { name: "Cancel drawing" })).toBeTruthy();
  fireEvent.pointerMove(canvas, { clientX: 900, clientY: 450 });
  fireEvent.pointerUp(canvas);
  expect(screen.getByRole("button", { name: "Add diagram" })).toBeTruthy();
  const box = screen.getByRole("button", { name: /Move diagram 2/ }).parentElement!;
  expect(box.style.top).toBe("10%");
  expect(box.style.height).toBe("80%");
  expect(document.activeElement).toBe(canvas);
  fireEvent.keyDown(canvas, { key: "Delete" });
  expect(screen.queryByRole("button", { name: /Move diagram 2/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Undo remove" }));
  const restored = screen.getByRole("button", { name: /Move diagram 2/ }).parentElement!;
  expect(restored.style.top).toBe("10%");
  expect(restored.style.height).toBe("80%");
});

it("supports Mac Backspace without removing a crop while editing its title", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ image_data_url: "data:image/png;base64,eA==" });
  const saved = vi.fn();
  const { container } = render(<DeckCropReview deck={deck} onSaved={saved} />);
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "Add diagram" }));
  fireEvent.click(screen.getByRole("button", { name: "Add centered box instead" }));
  const title = within(screen.getByRole("group", { name: "Diagram 2" })).getByLabelText("Title");
  fireEvent.keyDown(title, { key: "Backspace" });
  expect(screen.getByRole("button", { name: /Move diagram 2/ })).toBeTruthy();
  fireEvent.keyDown(container.querySelector(".crop-canvas")!, { key: "Backspace" });
  expect(screen.queryByRole("button", { name: /Move diagram 2/ })).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: /Move diagram 1/ }));
  fireEvent.keyDown(screen.getByRole("button", { name: /Move diagram 1/ }), { key: "Delete" });
  expect(screen.getByRole("button", { name: /Move diagram 1/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = vi.mocked(apiFetch).mock.calls.find(([path]) => path.endsWith("/review"))!;
  expect(JSON.parse(call[1]!.body as string).items).toHaveLength(1);
});
