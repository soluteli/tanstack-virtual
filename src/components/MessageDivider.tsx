export function MessageDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        color: "#9f2d20",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <div style={{ flex: 1, height: 1, background: "#efb3aa" }} />
      <span>new messages divider</span>
      <div style={{ flex: 1, height: 1, background: "#efb3aa" }} />
    </div>
  );
}