import { describe, expect, it } from "vitest";
import { filtrarPagamentos } from "@/utils/filtroPagamentos";

const pagamentos = [
  { id: "1", status: "pago", forma_pagamento: "pix" },
  { id: "2", status: "pago", forma_pagamento: "dinheiro" },
  { id: "3", status: "parcial", forma_pagamento: "transferencia" },
  { id: "4", status: "pago", forma_pagamento: "cartao" },
  { id: "5", status: "pendente", forma_pagamento: null },
];

describe("filtrarPagamentos", () => {
  it("mantém todos os registros quando os filtros estão em todos", () => {
    expect(filtrarPagamentos(pagamentos, "todos", "todos")).toHaveLength(5);
  });

  it.each([
    ["pix", "1"],
    ["dinheiro", "2"],
    ["transferencia", "3"],
    ["cartao", "4"],
  ] as const)("filtra pelo meio %s", (meio, idEsperado) => {
    expect(filtrarPagamentos(pagamentos, "todos", meio).map(({ id }) => id)).toEqual([idEsperado]);
  });

  it("combina os filtros de status e meio de pagamento", () => {
    expect(filtrarPagamentos(pagamentos, "pago", "transferencia")).toEqual([]);
    expect(filtrarPagamentos(pagamentos, "parcial", "transferencia")).toEqual([pagamentos[2]]);
  });
});