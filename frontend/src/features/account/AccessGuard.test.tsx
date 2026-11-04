import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
import api from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
import AccountGuard from "./AccountGuard";
import AuthorGuard from "../author/AuthorGuard";
describe("guarded identity changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("userId", "7");
    useAuthStore.setState({ authUser: null, accessToken: "fixture" });
    vi.mocked(api.get).mockResolvedValue({
      data: { metadata: { roles: ["AUTHOR"] } },
    });
  });
  it.each([AccountGuard, AuthorGuard])(
    "preserves edits during hydration and hides them immediately after logout (%s)",
    async (Guard) => {
      render(
        <MemoryRouter>
          <Routes>
            <Route element={<Guard />}>
              <Route
                path="/"
                element={<input aria-label="Unsaved text" defaultValue="" />}
              />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
      const field = await screen.findByLabelText("Unsaved text");
      await userEvent.type(field, "Keep my draft");
      act(() =>
        useAuthStore.setState({
          authUser: { id: 7, email: "fixture@example.invalid" },
        }),
      );
      expect(screen.getByLabelText("Unsaved text")).toHaveValue(
        "Keep my draft",
      );
      expect(api.get).toHaveBeenCalledTimes(1);
      act(() => {
        localStorage.removeItem("userId");
        useAuthStore.setState({ authUser: null });
      });
      expect(screen.queryByLabelText("Unsaved text")).not.toBeInTheDocument();
    },
  );
});
