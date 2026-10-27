/** Keep loopback development requests on the browser's host so SameSite cookies work. */
export function apiBase() {
  const configured = (import.meta.env["VITE_API_BASE_URL"] ?? "http://127.0.0.1:8001").replace(
    /\/$/,
    "",
  );
  if (typeof window !== "undefined") {
    const url = new URL(configured);
    const local = new Set(["localhost", "127.0.0.1"]);
    if (local.has(url.hostname) && local.has(window.location.hostname)) {
      url.hostname = window.location.hostname;
      return url.origin;
    }
  }
  return configured;
}
