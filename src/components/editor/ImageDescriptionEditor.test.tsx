// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiFetch, apiUpload } from "../../lib/api";
import ImageDescriptionEditor from "./ImageDescriptionEditor";

vi.mock("../../lib/api", () => ({ apiFetch: vi.fn(), apiUpload: vi.fn() }));
vi.mock("../ReactFlowViewer", () => ({ FlowchartViewer: () => null }));
const props = {
  title: "Protein", shortAlt: "Edited alt text", summary: "Edited description",
  image: "data:image/png;base64,eA==", saving: false, dirty: false, status: "",
  sharing: "private" as const, imagePublic: false, publicPath: null,
  onSharingSave: vi.fn(), onTitle: vi.fn(), onAlt: vi.fn(), onSummary: vi.fn(),
  onSave: vi.fn().mockResolvedValue(true),
};
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it("edits descriptions without a graph or section parser", () => {
  render(<ImageDescriptionEditor {...props} />);
  expect(screen.getByLabelText("Long description and transcribed text")).toHaveProperty("value", "Edited description");
  fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "Reviewed alt" } });
  expect(props.onAlt).toHaveBeenCalledWith("Reviewed alt");
  expect(screen.queryByText("Visual")).toBeNull();
});

it("regenerates from the source image and uses the returned descriptions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: async () => new Blob(["image"], { type: "image/png" }) }));
  vi.mocked(apiUpload).mockResolvedValue({ job_id: 2 });
  vi.mocked(apiFetch).mockResolvedValue({ status: "done", result: { short_alt: "New alt", summary: "New description" } });
  render(<ImageDescriptionEditor {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /Regenerate/ }));
  await waitFor(() => expect(props.onSummary).toHaveBeenCalledWith("New description"));
  expect(props.onAlt).toHaveBeenCalledWith("New alt");
  expect(vi.mocked(apiUpload).mock.calls[0][1].get("file")).toBeInstanceOf(File);
});

it("keeps edits if generation fails and exposes save errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
  render(<ImageDescriptionEditor {...props} status="Save failed." />);
  expect(screen.getByRole("alert").textContent).toBe("Save failed.");
  fireEvent.click(screen.getByRole("button", { name: /Regenerate/ }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Network unavailable"));
  expect(props.onAlt).not.toHaveBeenCalled();
  expect(props.onSummary).not.toHaveBeenCalled();
});
