import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("introduces the LeetRevise application", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /turn solved problems into lasting patterns/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("LeetRevise")).toBeInTheDocument();
  });
});
