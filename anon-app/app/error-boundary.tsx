"use client";

import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (typeof console !== "undefined") {
      console.error("[ANON//] crash:", error);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#040203",
        color: "#e8dde2",
        fontFamily: "'Courier New', monospace",
        padding: "20px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "420px" }}>
          <div style={{ fontSize: "64px", color: "#ff2d55", lineHeight: 1 }}>⚠</div>
          <h1 style={{
            fontFamily: "'Times New Roman', serif",
            fontSize: "26px",
            color: "#f4e8e8",
            margin: "16px 0 12px",
          }}>
            Something broke.
          </h1>
          <p style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#8a7276",
            margin: "0 0 20px",
          }}>
            ANON hit an unexpected error. Your session is still safe —
            just reload the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#7a0a1c",
              border: 0,
              borderRadius: "6px",
              color: "#fff",
              padding: "12px 24px",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              letterSpacing: "2px",
              fontWeight: 700,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
