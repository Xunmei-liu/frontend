// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RepresentationBrowser from "./RepresentationBrowser";

vi.mock("../ReactFlowViewer", () => ({ FlowchartViewer: () => <div>Graph preview</div> }));
afterEach(cleanup);

it("shows the original image and description, with retired views falling back to Summary", () => {
  render(<RepresentationBrowser
    data={{ nodes: [], edges: [], description_mode: "asu" }}
    summary="Four levels of protein structure." shortAlt="Protein structure levels."
    imageDataUrl="data:image/png;base64,eA==" initialView="tactile"
  />);
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Summary", "Alt text"]);
  expect(screen.getByRole("img").getAttribute("alt")).toBe("Protein structure levels.");
  expect(screen.getByText("Four levels of protein structure.")).toBeTruthy();
  expect(screen.queryByText("Graph preview")).toBeNull();
});

it("removes Tactile and Navigable from old diagrams too", () => {
  render(<RepresentationBrowser data={{ nodes: [], edges: [] }} summary="Existing description" initialView="navigable" />);
  expect(screen.queryByRole("option", { name: /Tactile|Navigable/ })).toBeNull();
  expect(screen.getByText("Existing description")).toBeTruthy();
});
