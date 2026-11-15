/** PATCH /api/guides/{id} {title}. Returns false when the server cannot rename yet (404/405): the name is then kept on this phone only. */
export async function renameGuide(id: string, title: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/guides/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
