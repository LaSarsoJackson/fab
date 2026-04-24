/** @jest-environment jsdom */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { APP_PROFILE } from "./features/fab/profile";
import { isAdminStudioEnabled } from "./shared/runtime";

jest.mock("./Map", () => ({
  __esModule: true,
  default: () => <div>Map stub</div>,
}));

jest.mock("./AdminRoute", () => ({
  __esModule: true,
  default: () => <div>Admin route stub</div>,
}));

jest.mock("./shared/runtime", () => {
  const actual = jest.requireActual("./shared/runtime");
  return {
    ...actual,
    isAdminStudioEnabled: jest.fn(),
  };
});

const renderApp = () => render(<App />);

describe("App", () => {
  const originalHash = window.location.hash;
  const originalTitle = document.title;
  const originalDescription = document.head.querySelector('meta[name="description"]');

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

    const currentDescription = document.head.querySelector('meta[name="description"]');
    if (!originalDescription && currentDescription) {
      currentDescription.remove();
    } else if (originalDescription && currentDescription) {
      currentDescription.setAttribute(
        "content",
        originalDescription.getAttribute("content") || ""
      );
    }
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
      window.location.hash = "#/admin";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    await waitFor(() => {
      expect(screen.getByText("Admin route stub")).toBeInTheDocument();
    });
  });
});
