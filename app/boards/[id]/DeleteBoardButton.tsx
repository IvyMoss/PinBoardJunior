"use client";

import { deleteBoard } from "../actions";

export function DeleteBoardButton({ boardId }: { boardId: string }) {
  return (
    <form
      action={deleteBoard}
      onSubmit={(e) => {
        if (!confirm("Delete this board? The ideas in your vault will be kept.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="boardId" value={boardId} />
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
        Delete board
      </button>
    </form>
  );
}
