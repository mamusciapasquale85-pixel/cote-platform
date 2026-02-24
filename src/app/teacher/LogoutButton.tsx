"use client";

export default function LogoutButton() {
  return (
    <form action="/auth/logout" method="post">
      <button
        type="submit"
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #444",
          cursor: "pointer",
        }}
      >
        Se déconnecter
      </button>
    </form>
  );
}