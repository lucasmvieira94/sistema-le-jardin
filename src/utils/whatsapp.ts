/**
 * Envio direto pelo WhatsApp via link oficial `wa.me`.
 * Não usa API paga: abre o WhatsApp (Web ou app) com contato e texto prontos;
 * o operador confirma o envio com um clique.
 */

/** Normaliza telefone brasileiro para dígitos com DDI 55. Retorna null se inválido. */
export function formatarNumeroWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let d = telefone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = d.replace(/^0+/, ""); // ex.: 011 9...
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return null;
  return d;
}

/** Monta o link `wa.me`; sem telefone, abre o seletor de contatos do WhatsApp. */
export function gerarLinkWhatsApp(telefone: string | null | undefined, mensagem = ""): string | null {
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  if (!telefone) return `https://wa.me/${texto}`;
  const numero = formatarNumeroWhatsApp(telefone);
  return numero ? `https://wa.me/${numero}${texto}` : null;
}

/** Abre o WhatsApp em nova aba. Retorna false se o telefone for inválido. */
export function abrirWhatsApp(telefone: string | null | undefined, mensagem = ""): boolean {
  const url = gerarLinkWhatsApp(telefone, mensagem);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
