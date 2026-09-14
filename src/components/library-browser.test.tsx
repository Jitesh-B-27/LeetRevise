import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LibraryBrowser } from "./library-browser";

const submissions = [
  { id: "1", problemSlug: "two-sum", title: "Two Sum", difficulty: "Easy" as const, language: "TypeScript", runtimeMs: 40, memoryMb: 18, submittedAt: "2026-09-14T08:00:00Z" },
  { id: "2", problemSlug: "minimum-window-substring", title: "Minimum Window Substring", difficulty: "Hard" as const, language: "Python3", runtimeMs: null, memoryMb: null, submittedAt: "2025-09-14T08:00:00Z" },
];

describe("LibraryBrowser", () => {
  it("filters submissions by search and difficulty", () => {
    render(<LibraryBrowser submissions={submissions} />);
    expect(screen.getByText("2 problems")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search problems"), { target: { value: "window" } });
    expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
    expect(screen.getByText("Minimum Window Substring")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "Easy" } });
    expect(screen.getByText("No problems match this view")).toBeInTheDocument();
  });
});
