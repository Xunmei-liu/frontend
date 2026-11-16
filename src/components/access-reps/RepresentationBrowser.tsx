import React, { useMemo, useState } from "react";
import type { FlowchartData } from "../../types/types";
import { isDataStructure, normalizeDiagramType } from "../../arboretum/diagramTypes";
import { viewsForType } from "../../arboretum/views";
import type { ViewId } from "../../arboretum/views";
import AccessibleTable from "./AccessibleTable";
import AccessibleMarkdown from "./AccessibleMarkdown";
import AltTextView from "./AltTextView";
import { TypedTable, canRenderBrailleLabels } from "./typed/TypedViews";

type Props = {
  data: FlowchartData;
  /** Saved diagram type (`flowchart_type`); anything unknown is treated as a flowchart. */
  diagramType?: string | null;
  summary: string;
  shortAlt?: string | null;
  title?: string | null;
  imageDataUrl?: string | null;
  /** Editor route, so an empty Alt text view can link back to it. */
  editPath?: string;
  /** View to start on, e.g. from `?view=` in the URL. Falls back to the type's default. */
  initialView?: string | null;
  onViewChange?: (view: ViewId) => void;
};

/** The "Choose a representation" menu and the chosen view, for any diagram type. */
const RepresentationBrowser: React.FC<Props> = ({
  data,
  diagramType,
  summary,
  shortAlt,
  title,
  imageDataUrl,
  editPath,
  initialView,
  onViewChange,
}) => {
  const type = normalizeDiagramType(diagramType);
  const braille = useMemo(
    () => isDataStructure(type) && canRenderBrailleLabels(type, data),
    [type, data]
  );
  const views = useMemo(() => viewsForType(type, braille).filter(
    (option) => option.value !== "navigable" && option.value !== "tactile" &&
      (option.value !== "table" || (data.description_mode !== "asu" && data.nodes.length > 0))
  ), [type, braille, data]);

  const [picked, setPicked] = useState<ViewId | null>(null);
  const requested = (picked ?? initialView) as ViewId | null;
  const view: ViewId = views.some((v) => v.value === requested)
    ? (requested as ViewId)
    : views[0].value;

  return (
    <div>
      <label htmlFor="view-select" style={{ fontWeight: "bold" }}>
        Choose a representation:
      </label>
      <select
        id="view-select"
        value={view}
        onChange={(e) => {
          const next = e.target.value as ViewId;
          setPicked(next);
          onViewChange?.(next);
        }}
        style={{ marginTop: 10, padding: 6, display: "block" }}
      >
        {views.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 24, textAlign: "left" }}>
        {view === "summary" && (
          <AccessibleMarkdown
            content={summary}
            imageDataUrl={imageDataUrl}
            imageAlt={shortAlt ?? ""}
            flowchartData={data.description_mode === "asu" ? null : data}
          />
        )}
        {view === "alt" && <AltTextView shortAlt={shortAlt} title={title} editPath={editPath} />}
        {view === "table" &&
          (isDataStructure(type) ? (
            <TypedTable type={type} data={data} title={title} />
          ) : (
            <AccessibleTable json={data} />
          ))}
      </div>
    </div>
  );
};

export default RepresentationBrowser;
