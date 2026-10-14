/**
 * Criptografia do Canal de Denúncias (AES-256-GCM) e hash de senha (PBKDF2).
 * A chave vem do segredo DENUNCIA_CHAVE e nunca sai do servidor.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

let chaveCache: CryptoKey | null = null;
async function chave(): Promise<CryptoKey> {
  if (chaveCache) return chaveCache;
  const segredo = Deno.env.get("DENUNCIA_CHAVE");
  if (!segredo) throw new Error("DENUNCIA_CHAVE não configurada");
  const bruto = await crypto.subtle.digest("SHA-256", enc.encode(segredo));
  chaveCache = await crypto.subtle.importKey("raw", bruto, "AES-GCM", false, ["encrypt", "decrypt"]);
  return chaveCache;
}

export function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function deB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function cifrarBytes(dados: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(), dados));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return out;
}
export async function decifrarBytes(dados: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: dados.subarray(0, 12) }, await chave(), dados.subarray(12)));
}
export async function cifrarTexto(t: unknown): Promise<string> {
  return b64(await cifrarBytes(enc.encode(JSON.stringify(t))));
}
export async function decifrarTexto<T = unknown>(s: string): Promise<T> {
  return JSON.parse(dec.decode(await decifrarBytes(deB64(s))));
}

export async function sha256Hex(dados: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", dados));
  return Array.from(h).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function pbkdf2(senha: string, sal: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: sal, iterations: 150000, hash: "SHA-256" }, k, 256));
}
export async function hashSenha(senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${b64(sal)}$${b64(await pbkdf2(senha, sal))}`;
}
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [, sal, h] = guardado.split("$");
  if (!sal || !h) return false;
  const calc = b64(await pbkdf2(senha, deB64(sal)));
  if (calc.length !== h.length) return false;
  let d = 0;
  for (let i = 0; i < calc.length; i++) d |= calc.charCodeAt(i) ^ h.charCodeAt(i);
  return d === 0;
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function aleatorio(n: number): string {
  const r = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(r).map((b) => ALFABETO[b % ALFABETO.length]).join("");
}
/** Protocolo curto e imprevisível, ex.: A5-B98-X2Q */
export function gerarProtocolo(): string {
  return `${aleatorio(2)}-${aleatorio(3)}-${aleatorio(3)}`;
}
export function gerarSenha(): string {
  return aleatorio(10);
}
