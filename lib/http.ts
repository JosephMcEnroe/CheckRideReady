export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!text) return {} as T;

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Expected JSON but received ${contentType || "unknown content-type"}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON response from server.");
  }
}
