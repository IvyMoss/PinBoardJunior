"use client";

import { removeIdeaFromBoard } from "../actions";

export function RemoveFromBoardButton({
  boardId,
  ideaId,
}: {
  boardId: string;
  ideaId: string;
}) {
  return (
    <form
      action={removeIdeaFromBoard}
      onSubmit={(e) => {
        if (!confirm("Remove this idea from the board? It will stay in your vault.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="ideaId" value={ideaId} />
      <button style={removeBtn} aria-label="Remove from board">
        Remove
      </button>
    </form>
  );
}

const removeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#c0392b",
  cursor: "pointer",
  fontSize: "0.8rem",
  textDecoration: "underline",
  padding: 0,
};
