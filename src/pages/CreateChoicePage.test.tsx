// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axe from "axe-core";
import CreateChoicePage from "./CreateChoicePage";

afterEach(cleanup);

function renderChoices() {
  return render(<MemoryRouter initialEntries={["/create"]}>
    <Routes>
      <Route path="/create" element={<CreateChoicePage />} />
      <Route path="/create/image" element={<h1>Single image form</h1>} />
      <Route path="/decks/new" element={<h1>PDF upload form</h1>} />
    </Routes>
  </MemoryRouter>);
}

it("offers two clearly labelled destinations without showing the image form", async () => {
  const { container } = renderChoices();
  expect(screen.getByRole("link", { name: "Create a STEM image" }).getAttribute("href")).toBe("/create/image");
  expect(screen.getByRole("link", { name: "Upload a slide deck" }).getAttribute("href")).toBe("/decks/new");
  expect(screen.queryByRole("textbox")).toBeNull();
  const report = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(report.violations).toEqual([]);
});

it("opens the single image flow with the keyboard", async () => {
  const user = userEvent.setup();
  renderChoices();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Create a STEM image" }));
  await user.keyboard("{Enter}");
  expect(screen.getByRole("heading", { name: "Single image form" })).toBeTruthy();
});

it("opens the PDF flow from the slide deck card", async () => {
  const user = userEvent.setup();
  renderChoices();
  await user.click(screen.getByRole("link", { name: "Upload a slide deck" }));
  expect(screen.getByRole("heading", { name: "PDF upload form" })).toBeTruthy();
});
