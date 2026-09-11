const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");

export async function requestApi(path, options = {}) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(path === "/api/chat" ? 50_000 : 12_000),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Backend not reachable. Start the local server, or configure VITE_API_BASE_URL for static hosting.");
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request failed. Please try again.");
    return data;
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error("The request timed out. Please try again.");
    if (error instanceof TypeError) throw new Error("Cannot reach the backend. Check that the server is running.");
    throw error;
  }
}
