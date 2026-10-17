export function fichaConcluida(status: string): boolean {
  return status === 'preenchida' || status === 'aprovada';
}

/** The recipient is always the institution's saved address, never request input. */
export function emailResidencial(valor: unknown): string {
  if (typeof valor !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())) {
    throw new Error('Cadastre um e-mail válido do residencial em Configurações.');
  }
  return valor.trim();
}