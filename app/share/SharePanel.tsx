import { makeObjectPrivate, removeShare, shareObjectWithUser } from "./actions";
import type { ShareRow } from "./data";

type ObjectType = "idea" | "board";

interface SharePanelProps {
  objectType: ObjectType;
  objectId: string;
  visibility: string;
  shares: ShareRow[];
  returnTo: string;
}

export function SharePanel({
  objectType,
  objectId,
  visibility,
  shares,
  returnTo,
}: SharePanelProps) {
  const isPrivate = visibility === "private";
  const label = objectType === "idea" ? "idea" : "board";

  return (
    <section style={panel}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>Share</h2>
          <small style={muted}>{isPrivate ? "Private" : "Shared with people"}</small>
        </div>
        {!isPrivate && (
          <form action={makeObjectPrivate}>
            <HiddenFields objectType={objectType} objectId={objectId} returnTo={returnTo} />
            <button style={quietBtn}>Make private</button>
          </form>
        )}
      </div>

      <div style={tierRow} aria-label={`${label} visibility`}>
        <span style={isPrivate ? activePill : inactivePill}>Private</span>
        <span style={!isPrivate ? activePill : inactivePill}>People</span>
      </div>

      <form action={shareObjectWithUser} style={shareForm}>
        <HiddenFields objectType={objectType} objectId={objectId} returnTo={returnTo} />
        <input name="handle" placeholder="@handle" required style={{ ...inputStyle, flex: 1 }} />
        <select name="permission" defaultValue="view" style={selectStyle} aria-label="Permission">
          <option value="view">View</option>
          <option value="comment">Comment</option>
          <option value="edit">Edit</option>
        </select>
        <button style={primaryBtn}>Share</button>
      </form>

      <div style={shareList}>
        {shares.length === 0 && <small style={muted}>No people yet.</small>}
        {shares.map((share) => (
          <div key={share.id} style={shareRow}>
            <div style={{ minWidth: 0 }}>
              <strong style={shareLabel}>{share.label}</strong>
              <small style={muted}>
                {share.detail} · {share.permission}
              </small>
            </div>
            <form action={removeShare}>
              <HiddenFields objectType={objectType} objectId={objectId} returnTo={returnTo} />
              <input type="hidden" name="shareId" value={share.id} />
              <button style={removeBtn}>Remove</button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

function HiddenFields({
  objectType,
  objectId,
  returnTo,
}: {
  objectType: ObjectType;
  objectId: string;
  returnTo: string;
}) {
  return (
    <>
      <input type="hidden" name="objectType" value={objectType} />
      <input type="hidden" name="objectId" value={objectId} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
}

const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1rem",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  marginTop: "1rem",
};
const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};
const title: React.CSSProperties = {
  fontSize: "1rem",
  margin: 0,
};
const muted: React.CSSProperties = {
  color: "#777",
  display: "block",
  fontSize: "0.8rem",
};
const tierRow: React.CSSProperties = {
  display: "flex",
  gap: "0.4rem",
};
const activePill: React.CSSProperties = {
  border: "1px solid #111",
  borderRadius: 999,
  color: "#111",
  fontSize: "0.78rem",
  padding: "0.25rem 0.55rem",
};
const inactivePill: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 999,
  color: "#999",
  fontSize: "0.78rem",
  padding: "0.25rem 0.55rem",
};
const shareForm: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};
const inputStyle: React.CSSProperties = {
  padding: "0.55rem 0.65rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.9rem",
  minWidth: 140,
  boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width: 116,
};
const primaryBtn: React.CSSProperties = {
  padding: "0.55rem 0.85rem",
  borderRadius: 8,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.9rem",
};
const quietBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#c0392b",
  cursor: "pointer",
  fontSize: "0.8rem",
  padding: 0,
  textDecoration: "underline",
};
const shareList: React.CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};
const shareRow: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
};
const shareLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const removeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  fontSize: "0.8rem",
  padding: 0,
  textDecoration: "underline",
};
