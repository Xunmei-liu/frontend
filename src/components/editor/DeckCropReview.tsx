import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { apiFetch } from "../../lib/api";
import type { DeckResult } from "../../services/slideDecks";
import "./deckCropReview.css";

export type CropBox = [number, number, number, number];
type Crop = { key: string; id?: string; page_number: number; title: string; box: CropBox; selected: boolean };
type Gesture = { key: string; mode: string; start: [number, number]; box: CropBox };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function adjustBox(box: CropBox, mode: string, dx: number, dy: number): CropBox {
  const [top, left, bottom, right] = box;
  if (mode === "move") {
    dx = clamp(dx, -left, 1000 - right);
    dy = clamp(dy, -top, 1000 - bottom);
    return [top + dy, left + dx, bottom + dy, right + dx];
  }
  return [
    mode.includes("n") ? clamp(top + dy, 0, bottom - 5) : top,
    mode.includes("w") ? clamp(left + dx, 0, right - 5) : left,
    mode.includes("s") ? clamp(bottom + dy, top + 5, 1000) : bottom,
    mode.includes("e") ? clamp(right + dx, left + 5, 1000) : right,
  ];
}

const handles = [
  ["nw", "top left"], ["n", "top"], ["ne", "top right"], ["e", "right"],
  ["se", "bottom right"], ["s", "bottom"], ["sw", "bottom left"], ["w", "left"],
] as const;

export default function DeckCropReview({ deck, onSaved }: { deck: DeckResult; onSaved: () => void }) {
  const [crops, setCrops] = useState<Crop[]>(() => deck.items.map(item => ({
    key: item.id, id: item.id, page_number: item.page_number, title: item.title,
    box: item.box ?? [0, 0, 1000, 1000], selected: item.selected !== false,
  })));
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageRetry, setImageRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [removed, setRemoved] = useState<{ crop: Crop; index: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pageCrops = crops.filter(crop => crop.page_number === page);
  const selected = crops.filter(crop => crop.selected).length;
  const current = pageCrops.find(crop => crop.key === active);

  useEffect(() => {
    const controller = new AbortController();
    setImage("");
    setImageError("");
    apiFetch<{ image_data_url: string }>(`/decks/${deck.id}/slides/${page}/image`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setImage(result.image_data_url); })
      .catch(() => { if (!controller.signal.aborted) setImageError("Could not load this slide."); });
    return () => controller.abort();
  }, [deck.id, page, imageRetry]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(key: string, changes: Partial<Crop>) {
    setCrops(previous => previous.map(crop => crop.key === key ? { ...crop, ...changes } : crop));
    setDirty(true);
  }

  function add(box: CropBox) {
    setRemoved(null);
    const key = crypto.randomUUID();
    setCrops(previous => [...previous, { key, page_number: page, title: `Diagram ${pageCrops.length + 1}`, box, selected: true }]);
    setActive(key);
    setDirty(true);
    return key;
  }

  function removeAdded(crop: Crop) {
    if (busy || crop.id) return;
    setRemoved({ crop, index: crops.findIndex(item => item.key === crop.key) });
    setCrops(previous => previous.filter(item => item.key !== crop.key));
    setActive(null);
    setDrawing(false);
    gesture.current = null;
    setDirty(true);
    canvas.current?.focus({ preventScroll: true });
  }

  function undoRemoval() {
    if (!removed) return;
    const { crop, index } = removed;
    setCrops(previous => [...previous.slice(0, index), crop, ...previous.slice(index)]);
    changePage(crop.page_number);
    setActive(crop.key);
    setRemoved(null);
    setDirty(true);
    canvas.current?.focus({ preventScroll: true });
  }

  function deleteSelected(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    if (!current || current.id || busy) return;
    event.preventDefault();
    event.stopPropagation();
    removeAdded(current);
  }

  function point(event: PointerEvent): [number, number] {
    const bounds = canvas.current!.getBoundingClientRect();
    return [clamp((event.clientX - bounds.left) / bounds.width * 1000, 0, 1000),
      clamp((event.clientY - bounds.top) / bounds.height * 1000, 0, 1000)];
  }

  function begin(event: PointerEvent, crop?: Crop, mode = "move") {
    if (busy || event.button !== 0) return;
    const start = point(event);
    if (drawing && !crop) {
      const x = Math.min(start[0], 995), y = Math.min(start[1], 995);
      const box: CropBox = [y, x, y + 5, x + 5];
      gesture.current = { key: add(box), mode: "draw", start: [x, y], box };
    } else if (crop && !drawing) {
      setActive(crop.key);
      gesture.current = { key: crop.key, mode, start, box: [...crop.box] };
    } else return;
    event.preventDefault();
    event.stopPropagation();
    canvas.current!.setPointerCapture(event.pointerId);
    canvas.current!.focus({ preventScroll: true });
  }

  function move(event: PointerEvent) {
    const drag = gesture.current;
    if (!drag) return;
    const [x, y] = point(event);
    let box: CropBox;
    if (drag.mode === "draw") {
      const left = Math.min(drag.start[0], x), top = Math.min(drag.start[1], y);
      box = [top, left, Math.max(top + 5, Math.max(drag.start[1], y)), Math.max(left + 5, Math.max(drag.start[0], x))];
    } else box = adjustBox(drag.box, drag.mode, x - drag.start[0], y - drag.start[1]);
    update(drag.key, { box });
  }

  function keyboard(event: KeyboardEvent, crop: Crop, mode: string) {
    const step = event.shiftKey ? 20 : 5;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!delta[event.key]) return;
    event.preventDefault();
    update(crop.key, { box: adjustBox(crop.box, mode, ...delta[event.key]) });
  }

  function endGesture() {
    if (gesture.current?.mode === "draw") {
      setDrawing(false);
      canvas.current?.focus({ preventScroll: true });
    }
    gesture.current = null;
  }

  function changePage(next: number) {
    setPage(next);
    setActive(null);
    setDrawing(false);
    gesture.current = null;
  }

  async function save(generate: boolean) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/decks/${deck.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        revision: deck.revision ?? 0, generate,
        items: crops.map(({ key: _key, ...crop }) => crop),
      }) });
      setDirty(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the review.");
    } finally { setBusy(false); }
  }

  return <section className="crop-review" aria-labelledby="crop-review-title" onKeyDownCapture={deleteSelected}>
    <h2 id="crop-review-title">Review diagram crops</h2>
    <p>Adjust the boxes, uncheck diagrams you don’t need, or add a missing diagram. Descriptions are generated only after you confirm.</p>
    <p id="crop-help">Drag a box to move it or its handles to resize it, then choose Next slide to continue. You can also use arrow keys on a box or handle.</p>
    <fieldset disabled={busy} className="crop-review-controls">
      <legend className="sr-only">Crop review controls</legend>
      <div className="crop-toolbar">
        <div className="deck-actions">
        <label>Slide <select value={page} onChange={event => changePage(Number(event.target.value))}>
          {deck.pages.map((_, i) => <option key={i} value={i + 1}>{i + 1} of {deck.page_count}</option>)}
        </select></label>
        <button className="btn btn--outline" disabled={!image || pageCrops.length >= 12} onClick={() => setDrawing(value => !value)} aria-pressed={drawing}>
          {drawing ? "Cancel drawing" : "Add diagram"}
        </button>
        {drawing && <button className="btn btn--outline" onClick={() => { add([250, 250, 750, 750]); setDrawing(false); canvas.current?.focus({ preventScroll: true }); }}>Add centered box instead</button>}
        {removed && <button className="btn btn--outline" onClick={undoRemoval}>Undo remove</button>}
        </div>
        <div className="crop-slide-navigation" role="group" aria-label="Slide navigation">
          <button className="btn btn--outline" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous slide</button>
          <button className="btn" disabled={page === deck.page_count} onClick={() => changePage(page + 1)}>Next slide <span aria-hidden="true">→</span></button>
        </div>
      </div>
      {drawing && <p role="status">Drag across the slide to draw a new box, or choose “Add centered box instead”.</p>}
      {imageError && <p role="alert">{imageError} <button onClick={() => setImageRetry(value => value + 1)}>Reload slide</button></p>}
      {!image && !imageError && <p role="status">Loading slide…</p>}
      {image && <div ref={canvas} tabIndex={-1} role="group" aria-label="Diagram crop canvas" className={`crop-canvas ${drawing ? "crop-canvas--drawing" : ""}`}
        onPointerDown={event => begin(event)} onPointerMove={move}
        onPointerUp={endGesture} onPointerCancel={endGesture}>
        <img src={image} alt={`Full slide ${page} for selecting diagram crops`} draggable={false} />
        {pageCrops.map((crop, index) => <div key={crop.key}
          className={`crop-box ${crop.selected ? "" : "crop-box--excluded"} ${active === crop.key ? "crop-box--active" : ""}`}
          style={{ top: `${crop.box[0] / 10}%`, left: `${crop.box[1] / 10}%`, height: `${(crop.box[2] - crop.box[0]) / 10}%`, width: `${(crop.box[3] - crop.box[1]) / 10}%` }}>
          <button type="button" className="crop-box-move" aria-label={`Move diagram ${index + 1}: ${crop.title}`} aria-describedby="crop-help"
            onFocus={() => setActive(crop.key)} onClick={() => setActive(crop.key)} onPointerDown={event => begin(event, crop)} onKeyDown={event => keyboard(event, crop, "move")}>
            <span>{index + 1}{!crop.selected && " · Not selected"}</span>
          </button>
          {active === crop.key && handles.map(([mode, label]) => <button key={mode} type="button" className={`crop-handle crop-handle--${mode}`}
            aria-label={`Resize ${label} of diagram ${index + 1}`} aria-describedby="crop-help"
            onPointerDown={event => begin(event, crop, mode)} onKeyDown={event => keyboard(event, crop, mode)} />)}
        </div>)}
      </div>}
      <div className="crop-fields">
        {pageCrops.length === 0 && <p>No diagrams found on this slide. Use Add diagram to select one.</p>}
        {pageCrops.map((crop, index) => <fieldset key={crop.key} className={active === crop.key ? "crop-fields--active" : ""}>
          <legend>Diagram {index + 1}</legend>
          <label><input type="checkbox" checked={crop.selected} onChange={event => update(crop.key, { selected: event.target.checked })} /> Include diagram {index + 1}</label>
          {!crop.id && <button className="btn btn--outline" onClick={() => removeAdded(crop)}>Remove added diagram</button>}
          <label>Title<input value={crop.title} maxLength={200} onFocus={() => setActive(crop.key)} onChange={event => update(crop.key, { title: event.target.value })} /></label>
        </fieldset>)}
      </div>
      {current && <p className="crop-selection-note">Selected box: {current.title}{!current.id && ". Press Delete or Backspace to remove this added diagram."}</p>}
      {removed && <p role="status">Removed {removed.crop.title}. Choose Undo remove to restore it.</p>}
      <p role="status">{selected} diagrams selected across {deck.page_count} slides. {dirty ? "Unsaved changes." : "Changes saved."}</p>
      <div className="deck-actions">
        <button className="btn btn--outline" onClick={() => void save(false)} disabled={!dirty}>Save review</button>
        <button className="btn" onClick={() => void save(true)} disabled={!selected || crops.some(crop => !crop.title.trim())}>
          {busy ? "Saving…" : "Generate descriptions"}
        </button>
      </div>
    </fieldset>
    {error && <p className="deck-error" role="alert">{error}</p>}
  </section>;
}
