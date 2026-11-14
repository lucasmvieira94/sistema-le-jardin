import { assert, assertFalse } from "jsr:@std/assert";
import { tipoConfere } from "./tipo.ts";
Deno.test("aceita PDF e JPEG reais e recusa conteúdo trocado", () => {
  assert(tipoConfere("application/pdf", new TextEncoder().encode("%PDF-1.7")));
  assert(tipoConfere("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])));
  assertFalse(tipoConfere("application/pdf", new Uint8Array([0xff, 0xd8])));
  assertFalse(tipoConfere("image/png", new TextEncoder().encode("%PDF")));
});
