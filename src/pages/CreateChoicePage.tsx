import { Link } from "react-router-dom";
import "./styles/CreateChoicePage.css";

export default function CreateChoicePage() {
  return (
    <div className="create-choice">
      <h1>What would you like to create?</h1>
      <div className="create-choice-grid">
        <Link className="create-choice-card" to="/create/image" aria-labelledby="create-image-title" aria-describedby="create-image-description">
          <h2 id="create-image-title">Create a STEM image</h2>
          <p id="create-image-description">Upload a single diagram to generate alt text and a description, then review and edit before sharing.</p>
          <span className="create-choice-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="create-choice-card" to="/decks/new" aria-labelledby="create-deck-title" aria-describedby="create-deck-description">
          <h2 id="create-deck-title">Upload a slide deck</h2>
          <p id="create-deck-description">Upload a PDF, review the detected diagrams, and generate descriptions and shareable links.</p>
          <span className="create-choice-arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
