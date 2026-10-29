/** Keep loopback development requests on the browser's host so SameSite cookies work. */
export function apiBase() {
  const defaultBase = import.meta.env.PROD ? "http://217.216.76.178:8002" : "http://127.0.0.1:8001";
  const configured = (import.meta.env["VITE_API_BASE_URL"] ?? defaultBase).replace(/\/$/, "");
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
