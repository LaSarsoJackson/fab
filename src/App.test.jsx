/** @jest-environment jsdom */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { APP_PROFILE } from "./features/fab/profile";
import { ADMIN_HASH } from "./shared/routing";
import { isAdminStudioEnabled, syncDocumentMetadata } from "./shared/runtime/runtimeEnv";

jest.mock("./Map", () => ({
  __esModule: true,
  default: () => <div>Map stub</div>,
}));

jest.mock("./AdminApp", () => ({
  __esModule: true,
  default: () => <div>Admin studio stub</div>,
}));

jest.mock("./shared/runtime/runtimeEnv", () => {
  const actual = jest.requireActual("./shared/runtime/runtimeEnv");
  return {
    ...actual,
    isAdminStudioEnabled: jest.fn(),
  };
});

const renderApp = () => render(<App />);

describe("App", () => {
  const originalHash = window.location.hash;
  const originalTitle = document.title;
  const originalHead = document.head.innerHTML;

  beforeEach(() => {
    isAdminStudioEnabled.mockReturnValue(true);
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
    isAdminStudioEnabled.mockReset();
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

  test("switches between the map and admin routes when the hash changes", async () => {
    renderApp();

    expect(await screen.findByText("Map stub")).toBeInTheDocument();

    act(() => {
      window.location.hash = ADMIN_HASH;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    await waitFor(() => {
      expect(screen.getByText("Admin studio stub")).toBeInTheDocument();
    });
  });

  test("shows the unavailable admin shell when the admin route is disabled", async () => {
    isAdminStudioEnabled.mockReturnValue(false);
    window.location.hash = ADMIN_HASH;

    renderApp();

    expect(await screen.findByRole("heading", { name: "Records workspace unavailable" })).toBeInTheDocument();
    expect(screen.queryByText("Admin studio stub")).not.toBeInTheDocument();
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
