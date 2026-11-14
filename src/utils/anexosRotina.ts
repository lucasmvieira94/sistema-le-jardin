import { lerPasse } from "./portalSessao";

/** Anexos de rotina: foto da prescrição/orientação ou PDF, enviados pelo portal. */
export const TIPOS_ANEXO = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_ANEXO = 10 * 1024 * 1024;
export interface AnexoRotina { id: string; nome_arquivo: string; tipo_mime: string; tamanho_bytes: number; enviado_por_nome: string | null; created_at: string }

export function validarAnexo(f: { type: string; size: number }): string | null {
  if (!TIPOS_ANEXO.includes(f.type)) return "Use foto (JPG, PNG, WEBP) ou PDF";
  if (f.size > MAX_ANEXO) return "Arquivo acima de 10 MB";
  return null;
}

/** Medidas para reduzir fotos grandes do celular mantendo a leitura do documento. */
export function dimensoesReduzidas(w: number, h: number, max = 2000) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Reduz fotos (câmera do celular costuma passar de 5 MB); PDFs vão como estão. */
export async function prepararAnexo(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 1.5 * 1024 * 1024) return f;
  const bmp = await createImageBitmap(f);
  const { w, h } = dimensoesReduzidas(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.85));
  return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

const urlFuncao = () => `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/rotina-anexo`;
const cabecalhos = () => ({ apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, "x-portal-token": lerPasse()?.token ?? "" });

export async function enviarAnexo(rotinaId: string, arquivo: File) {
  const fd = new FormData(); fd.append("rotina_id", rotinaId); fd.append("arquivo", await prepararAnexo(arquivo));
  const r = await fetch(urlFuncao(), { method: "POST", headers: cabecalhos(), body: fd });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Falha ao enviar anexo");
}

/** Baixa o arquivo (conferido no servidor) e devolve um endereço local para exibir. */
export async function abrirAnexo(id: string) {
  const r = await fetch(`${urlFuncao()}?id=${id}`, { headers: cabecalhos() });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Não foi possível abrir");
  return URL.createObjectURL(await r.blob());
}
