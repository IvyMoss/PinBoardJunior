"use client";

import { deleteIdea } from "../../vault/actions";

export function DeleteIdeaButton({ ideaId }: { ideaId: string }) {
  return (
    <form
      action={deleteIdea}
      onSubmit={(e) => {
        if (!confirm("Delete this idea permanently? This can’t be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="ideaId" value={ideaId} />
      <button
        type="submit"
        style={{
          background: "none",
          border: "1px solid #e0b4b0",
          color: "#c0392b",
          borderRadius: 8,
          padding: "0.5rem 0.9rem",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        Delete idea
      </button>
    </form>
  );
}
