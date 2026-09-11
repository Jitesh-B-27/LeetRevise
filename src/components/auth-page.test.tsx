import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/auth/actions", () => ({
  requestMagicLink: vi.fn(),
}));

import { AuthPage } from "./auth-page";

describe("AuthPage", () => {
  it("renders the signup experience and login navigation", () => {
    render(<AuthPage mode="signup" />);

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign up with email" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("renders login status and signup navigation", () => {
    render(<AuthPage mode="login" status="sent" />);

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log in with email" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/check your email/i);
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});
