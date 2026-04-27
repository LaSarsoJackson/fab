/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { APP_PROFILE } from "./features/fab/profile";
import { syncDocumentMetadata } from "./shared/runtime/runtimeEnv";

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

  test("updates the shared document and social metadata tags together", () => {
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta property="og:url" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
    `;

    syncDocumentMetadata({
      title: "Packet Title",
      description: "Packet description",
      url: "https://example.com/#/packet",
    });

    expect(document.title).toBe("Packet Title");
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "Packet description"
    );
    expect(document.head.querySelector('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Packet Title"
    );
    expect(document.head.querySelector('meta[property="og:description"]')).toHaveAttribute(
      "content",
      "Packet description"
    );
    expect(document.head.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://example.com/#/packet"
    );
    expect(document.head.querySelector('meta[name="twitter:title"]')).toHaveAttribute(
      "content",
      "Packet Title"
    );
    expect(document.head.querySelector('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      "Packet description"
    );
  });

  test("leaves missing metadata tags alone instead of throwing", () => {
    document.head.innerHTML = "";

    expect(() => {
      syncDocumentMetadata({
        title: "Fallback Title",
        description: "Fallback description",
        url: "https://example.com",
      });
    }).not.toThrow();

    expect(document.title).toBe("Fallback Title");
  });
});
