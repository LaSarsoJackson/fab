import React, { Suspense, lazy } from "react";
import "./App.css";

const BurialMap = lazy(() => import("./Map"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="app-shell-loading">
          <h1>Albany Rural Cemetery</h1>
          <p>Loading map experience…</p>
        </div>
      }
    >
      <BurialMap />
    </Suspense>
  );
}
