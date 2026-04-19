/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";

import AdminRoute from "./AdminRoute";

jest.mock("./AdminApp", () => ({
  __esModule: true,
  default: () => <div>Admin studio stub</div>,
}));

const originalEnv = { ...process.env };

describe("AdminRoute", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("hides the admin studio in production", () => {
    process.env.REACT_APP_ENVIRONMENT = "production";

    render(<AdminRoute />);

    expect(screen.getByRole("heading", { name: "Admin studio is only available in development" })).toBeInTheDocument();
    expect(screen.queryByText("Admin studio stub")).not.toBeInTheDocument();
  });

  test("renders the admin studio in development", async () => {
    process.env.REACT_APP_ENVIRONMENT = "development";

    render(<AdminRoute />);

    expect(await screen.findByText("Admin studio stub")).toBeInTheDocument();
  });
});
