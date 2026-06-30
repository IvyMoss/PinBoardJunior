import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <form
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: 320,
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>PinBoard Junior</h1>

        {error && (
          <p style={{ color: "#c0392b", fontSize: "0.85rem", margin: 0 }}>{error}</p>
        )}

        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={inputStyle}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={8}
          style={inputStyle}
        />

        <button formAction={signIn} style={primaryBtn}>
          Sign in
        </button>
        <button formAction={signUp} style={secondaryBtn}>
          Create account
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.95rem",
};
const primaryBtn: React.CSSProperties = {
  padding: "0.6rem",
  borderRadius: 8,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.95rem",
};
const secondaryBtn: React.CSSProperties = {
  padding: "0.6rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontSize: "0.95rem",
};
