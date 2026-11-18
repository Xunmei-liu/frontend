import { useEffect, useRef, useState } from "react";
import { apiFetch, apiUpload } from "../../lib/api";
import type { Sharing } from "../../lib/sharing";
import SharingControl from "../SharingControl";
import AccessibleMarkdown from "../access-reps/AccessibleMarkdown";
import "./imageDescription.css";

type Props = {
  title: string;
  shortAlt: string;
  summary: string;
  image: string | null;
  saving: boolean;
  dirty: boolean;
  status: string;
  sharing: Sharing;
  imagePublic: boolean;
  publicPath: string | null;
  onSharingSave: (next: { sharing: Sharing; imagePublic: boolean }) => Promise<void>;
  onTitle: (value: string) => void;
  onAlt: (value: string) => void;
  onSummary: (value: string) => void;
  onSave: () => Promise<boolean>;
};

export default function ImageDescriptionEditor(props: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function regenerate() {
    if (!props.image || generating) return;
    const controller = new AbortController();
    request.current = controller;
    setGenerating(true);
    setError("");
    try {
      const blob = await (await fetch(props.image, { signal: controller.signal })).blob();
      const form = new FormData();
      form.append("file", blob, "source-image");
      const { job_id } = await apiUpload<{ job_id: number }>("/jobs/process-upload", form, {
        signal: controller.signal,
      });
      while (!controller.signal.aborted) {
        const job = await apiFetch<{
          status: string;
          error: string | null;
          result: { short_alt: string; summary: string } | null;
        }>(`/jobs/${job_id}`, { signal: controller.signal });
        if (job.status === "failed") throw new Error(job.error || "Generation failed.");
        if (job.status === "done") {
          if (!job.result?.short_alt || !job.result.summary) throw new Error("The description is incomplete. Please retry.");
          props.onAlt(job.result.short_alt);
          props.onSummary(job.result.summary);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Generation failed.");
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  }

  return (
    <main className="image-description-editor">
      <h1>Complex image editor</h1>
      <SharingControl
        sharing={props.sharing} imagePublic={props.imagePublic}
        hasImage={!!props.image} publicPath={props.publicPath}
        onSave={props.onSharingSave} disabled={props.saving || generating}
      />
      {props.image && <img className="image-description-source" src={props.image} alt={props.shortAlt || props.title} />}
      <p>Review AI-generated descriptions before sharing.</p>
      <fieldset disabled={generating || props.saving} className="image-description-fields">
        <legend>Image descriptions</legend>
        <label htmlFor="image-title">Title</label>
        <input id="image-title" value={props.title} onChange={(e) => props.onTitle(e.target.value)} />
        <label htmlFor="image-alt">Alt text</label>
        <textarea id="image-alt" rows={3} value={props.shortAlt} onChange={(e) => props.onAlt(e.target.value)} />
        <label htmlFor="image-description">Long description and transcribed text</label>
        <textarea id="image-description" rows={12} value={props.summary} onChange={(e) => props.onSummary(e.target.value)} />
        <div className="image-description-actions">
          <button className="btn" onClick={() => void props.onSave()}>Save</button>
          <button className="btn btn--outline" disabled={!props.image} onClick={() => void regenerate()}>
            Regenerate (replaces your edits)
          </button>
        </div>
      </fieldset>
      {(error || (props.status && props.status !== "Saved.")) && <p role="alert">{error || props.status}</p>}
      <p role="status">{generating ? "Generating descriptions…" : props.saving ? "Saving…" : props.dirty ? "Unsaved changes" : props.status === "Saved." ? "Saved." : ""}</p>
      <section aria-label="Description preview">
        <h2>Description preview</h2>
        <AccessibleMarkdown content={props.summary} />
      </section>
    </main>
  );
}
