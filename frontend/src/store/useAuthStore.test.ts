import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../services/authService", () => ({
  authService: {
    fetchMe: vi.fn(),
    refreshToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { authService } from "../services/authService";
import { useAuthStore } from "./useAuthStore";
describe("client session async boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("userId", "1");
    useAuthStore.setState({
      authUser: { id: 1, email: "old@example.invalid" },
      accessToken: "old-access",
      isRefreshingToken: false,
      isFetchingUser: false,
      isLoggingIn: false,
    });
    vi.mocked(authService.logout).mockResolvedValue({});
  });
  it("retains the saved identity but clears an incompletely restored token after profile outage", async () => {
    vi.mocked(authService.refreshToken).mockResolvedValue("new-access");
    vi.mocked(authService.fetchMe).mockRejectedValue({
      isAxiosError: true,
      response: { status: 503 },
    });
    await expect(useAuthStore.getState().refreshToken()).rejects.toMatchObject({
      response: { status: 503 },
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem("userId")).toBe("1");
    expect(useAuthStore.getState().isRefreshingToken).toBe(false);
  });
  it("does not restore a profile that finishes after logout", async () => {
    let finish!: (
      user: NonNullable<ReturnType<typeof useAuthStore.getState>["authUser"]>,
    ) => void;
    vi.mocked(authService.fetchMe).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = useAuthStore.getState().fetchMe();
    await useAuthStore.getState().logout();
    finish({ id: 1, email: "old@example.invalid" });
    await pending;
    expect(useAuthStore.getState().authUser).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem("userId")).toBeNull();
  });
  it("does not restore a token that finishes after logout", async () => {
    let finish!: (token: string) => void;
    vi.mocked(authService.refreshToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(authService.fetchMe).mockResolvedValue({
      id: 1,
      email: "old@example.invalid",
    });
    const pending = useAuthStore.getState().refreshToken();
    await useAuthStore.getState().logout();
    finish("late-old-access");
    await pending;
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().authUser).toBeNull();
  });
  it("does not clear a newly signed-in account when an older profile request is rejected", async () => {
    let fail!: (error: unknown) => void;
    vi.mocked(authService.fetchMe).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const pending = useAuthStore.getState().fetchMe();
    vi.mocked(authService.login).mockResolvedValue({
      metadata: {
        user: { id: 2, email: "new@example.invalid" },
        tokens: { accessToken: "new-access" },
      },
    });
    await useAuthStore
      .getState()
      .login("new@example.invalid", "Fixture-only-2026!");
    fail({ isAxiosError: true, response: { status: 401 } });
    await pending;
    expect(useAuthStore.getState().authUser?.id).toBe(2);
    expect(useAuthStore.getState().accessToken).toBe("new-access");
  });
});
