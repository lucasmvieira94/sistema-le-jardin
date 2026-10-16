/**
 * Passe temporário do portal do colaborador (acesso por PIN).
 *
 * O servidor emite um token opaco ao validar o PIN (RPC `portal_iniciar_sessao`).
 * Ele é enviado em todo pedido ao banco pelo cabeçalho `x-portal-token`, e as
 * regras de acesso do banco usam esse passe para mostrar só os dados daquele
 * colaborador. Sem passe válido, o banco nega o acesso.
 */
import { supabase } from '@/integrations/supabase/client';

export const PORTAL_TOKEN_KEY = 'portal_token';
export const PORTAL_HEADER = 'x-portal-token';

interface PassePortal { token: string; expiraEm: number }

type ArmazenamentoSimples = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Lê o passe guardado, descartando-o se estiver vencido ou corrompido. */
export function lerPasse(store: ArmazenamentoSimples = sessionStorage, agora = Date.now()): PassePortal | null {
  try {
    const raw = store.getItem(PORTAL_TOKEN_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PassePortal;
    if (!p?.token || typeof p.expiraEm !== 'number' || p.expiraEm <= agora) {
      store.removeItem(PORTAL_TOKEN_KEY);
      return null;
    }
    return p;
  } catch {
    store.removeItem(PORTAL_TOKEN_KEY);
    return null;
  }
}

/** Coloca (ou retira) o cabeçalho do passe em todos os pedidos do cliente. */
function aplicarCabecalho(token: string | null) {
  const alvos = [(supabase as any).headers, (supabase as any).rest?.headers].filter(Boolean);
  for (const h of alvos) {
    if (token) h[PORTAL_HEADER] = token;
    else delete h[PORTAL_HEADER];
  }
}

export function guardarPasse(token: string, expiraEm: string | number) {
  const exp = typeof expiraEm === 'number' ? expiraEm : new Date(expiraEm).getTime();
  sessionStorage.setItem(PORTAL_TOKEN_KEY, JSON.stringify({ token, expiraEm: exp }));
  aplicarCabecalho(token);
}

export function temPasseValido(): boolean {
  return lerPasse() !== null;
}

/** Revoga o passe no servidor (se houver) e limpa localmente. */
export async function encerrarPasse() {
  if (lerPasse()) {
    try { await supabase.rpc('portal_encerrar_sessao' as any); } catch { /* sem rede: expira sozinho */ }
  }
  sessionStorage.removeItem(PORTAL_TOKEN_KEY);
  aplicarCabecalho(null);
}

/** Reaplica o passe guardado ao abrir/recarregar a página. */
export function restaurarPasse() {
  aplicarCabecalho(lerPasse()?.token ?? null);
}
