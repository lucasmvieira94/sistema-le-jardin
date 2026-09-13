import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcularSha256Hex, extrairIp } from "./auditoria.ts";

Deno.test("calcula o SHA-256 exato do PDF recebido", async () => {
  const hash = await calcularSha256Hex(new TextEncoder().encode("pdf-de-teste"));
  assertMatch(hash, /^[0-9a-f]{64}$/);
  assertEquals(hash, "f4a51a3a4024e6f7338ff6cdfdd5b6a8f23c59363c8fb4383b83e80a0c6cfc37");
});

Deno.test("registra somente o primeiro IP encaminhado", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
  assertEquals(extrairIp(headers), "203.0.113.10");
});