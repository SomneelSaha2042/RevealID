import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth, getServerApiBaseUrl } from "./health";

describe("homepage health badge", () => {
  const originalApiBaseUrl = process.env.API_BASE_URL;
  const originalPublicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    process.env.API_BASE_URL = originalApiBaseUrl;
    process.env.NEXT_PUBLIC_API_BASE_URL = originalPublicApiBaseUrl;
    vi.restoreAllMocks();
  });

  it("uses the server API base URL instead of the browser proxy path", async () => {
    delete process.env.API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(getHealth(fetchMock as typeof fetch)).resolves.toBe("API reachable");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/health", { cache: "no-store" });
  });

  it("honors API_BASE_URL when configured", () => {
    process.env.API_BASE_URL = "https://api.example.test";

    expect(getServerApiBaseUrl()).toBe("https://api.example.test");
  });

  it("shows unavailable when the health request fails", async () => {
    process.env.API_BASE_URL = "http://localhost:4000";
    const fetchMock = vi.fn(async () => {
      throw new Error("network unavailable");
    });

    await expect(getHealth(fetchMock as typeof fetch)).resolves.toBe("API unavailable");
  });
});
