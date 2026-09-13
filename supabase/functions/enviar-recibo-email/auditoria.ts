export async function calcularSha256Hex(bytes: Uint8Array): Promise<string> {
  const dados = Uint8Array.from(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function extrairIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}