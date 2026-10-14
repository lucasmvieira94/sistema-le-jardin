/**
 * Catálogo de módulos do portal do colaborador liberáveis por cargo.
 * Os ids são estáveis: ficam gravados em `cargos.modulos` e nas exceções
 * do funcionário. A mesma regra existe no banco em
 * `calcular_modulos_funcionario` — mantenha as duas em sincronia.
 */
export const MODULOS_PORTAL = [
  { id: "ponto", nome: "Registro de ponto", grupo: "Principais" },
  { id: "prontuario", nome: "Prontuário eletrônico", grupo: "Principais" },
  { id: "temperatura", nome: "Controle de temperatura", grupo: "Principais" },
  { id: "intercorrencias", nome: "Intercorrências", grupo: "Principais" },
  { id: "folhas_ponto", nome: "Minhas folhas de ponto", grupo: "Meu RH" },
  { id: "escala", nome: "Minha escala", grupo: "Meu RH" },
  { id: "documentos", nome: "Meus documentos", grupo: "Meu RH" },
  { id: "contracheques", nome: "Meus contracheques", grupo: "Meu RH" },
  { id: "desempenho", nome: "Meu desempenho", grupo: "Meu RH" },
  { id: "meus_prontuarios", nome: "Meus prontuários", grupo: "Residentes" },
  { id: "fraldas", nome: "Controle de fraldas", grupo: "Residentes" },
  { id: "medicamentos", nome: "Medicamentos", grupo: "Residentes" },
  { id: "vacinas", nome: "Cartão vacinal", grupo: "Residentes" },
  { id: "supervisor", nome: "Painel do supervisor", grupo: "Supervisão" },
  { id: "feedback", nome: "Feedback do sistema", grupo: "Outros" },
] as const;

export type ModuloId = (typeof MODULOS_PORTAL)[number]["id"];

/** Módulos de quem ainda não tem cargo (comportamento anterior ao cadastro de cargos). */
export const MODULOS_LEGADO: string[] = MODULOS_PORTAL.map((m) => m.id).filter((id) => id !== "supervisor");

export interface CargoModulos { modulos: string[] | null }
export interface FuncionarioModulos {
  acesso_supervisor?: boolean | null;
  modulos_extras?: string[] | null;
  modulos_bloqueados?: string[] | null;
}

/**
 * Calcula os módulos liberados: os do cargo (ou o padrão legado quando não há
 * cargo) somados às exceções liberadas e menos as bloqueadas.
 * Um cargo inativo continua valendo para quem já o possui.
 */
export function modulosEfetivos(cargo: CargoModulos | null | undefined, func: FuncionarioModulos): string[] {
  const base = cargo
    ? cargo.modulos ?? []
    : [...MODULOS_LEGADO, ...(func.acesso_supervisor ? ["supervisor"] : [])];
  const bloq = new Set(func.modulos_bloqueados ?? []);
  return Array.from(new Set([...base, ...(func.modulos_extras ?? [])]))
    .filter((m) => !bloq.has(m))
    .sort();
}

/** Converte a lista desejada em exceções relativas ao cargo. */
export function excecoesParaCargo(cargoModulos: string[], desejados: string[]) {
  const c = new Set(cargoModulos);
  const d = new Set(desejados);
  return {
    modulos_extras: desejados.filter((m) => !c.has(m)).sort(),
    modulos_bloqueados: cargoModulos.filter((m) => !d.has(m)).sort(),
  };
}
