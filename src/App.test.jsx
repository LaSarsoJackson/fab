/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { APP_PROFILE } from "./features/fab/profile";

jest.mock("./Map", () => ({
  __esModule: true,
  default: () => <div>Map stub</div>,
}));

const renderApp = () => render(<App />);

describe("App", () => {
  const originalHash = window.location.hash;
  const originalTitle = document.title;
  const originalHead = document.head.innerHTML;

  beforeEach(() => {
    window.location.hash = "";
    document.title = "";

    if (!document.head.querySelector('meta[name="description"]')) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    document.head.querySelector('meta[name="description"]').setAttribute("content", "");
  });

  afterEach(() => {
    window.location.hash = originalHash;
    document.title = originalTitle;
    document.head.innerHTML = originalHead;
  });

  test("syncs the document title and description from the app profile", async () => {
    renderApp();

    await screen.findByText("Map stub");

    expect(document.title).toBe(APP_PROFILE.shell?.documentTitle || APP_PROFILE.brand?.appName);
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      APP_PROFILE.shell?.description || ""
    );
  });

  test("renders the map shell from the production app entrypoint", async () => {
    renderApp();

    expect(await screen.findByText("Map stub")).toBeInTheDocument();
  });
});
