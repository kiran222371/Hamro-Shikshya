import React from "react";
import "../styles/app.css";

export default function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo-wrap">
          <div className="splash-logo">🎓</div>
        </div>

        <h1 className="splash-title">Hamro Shikshya</h1>
        <p className="splash-subtitle">Smart student life, organized simply.</p>

        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}