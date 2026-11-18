// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn().mockResolvedValue([]) }));
vi.mock("../lib/logResearchEvent", () => ({ logResearchEvent: vi.fn() }));
vi.mock("../components/dashboard/FlowchartCard", () => ({ default: () => null }));

afterEach(cleanup);

it("introduces the workflow before the image library", async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByText("Loaded 0");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome to Complex-Image-Accessibility");
  expect(screen.getByRole("heading", { name: "My complex images", level: 2 })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText(/AI can make mistakes/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/create");
  expect(screen.getByRole("link", { name: "About this project" }).getAttribute("href")).toBe("/about");
});
