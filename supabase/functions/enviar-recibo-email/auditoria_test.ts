import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcularSha256Hex, criarAnexoRecibo, extrairIp } from "./auditoria.ts";

Deno.test("calcula o SHA-256 exato do PDF recebido", async () => {
  const hash = await calcularSha256Hex(new TextEncoder().encode("pdf-de-teste"));
  assertMatch(hash, /^[0-9a-f]{64}$/);
  assertEquals(hash, "24a36537a58757674e628f6221a10681c85959d826cfa907d12cd9bcf1349ff6");
});

Deno.test("registra somente o primeiro IP encaminhado", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
  assertEquals(extrairIp(headers), "203.0.113.10");
});

Deno.test("envia o anexo ao Resend como string Base64", () => {
  const anexo = criarAnexoRecibo("recibo.pdf", "JVBERi0xLjQ=");
  assertEquals(anexo, { filename: "recibo.pdf", content: "JVBERi0xLjQ=" });
  assertEquals(typeof anexo.content, "string");
});