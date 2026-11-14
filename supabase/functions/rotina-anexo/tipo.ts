/** Assinatura mínima: confere que os bytes batem com o tipo declarado. */
export function tipoConfere(mime: string, b: Uint8Array) {
  if (mime === "application/pdf") return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50;
  if (mime === "image/webp") return b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return false;
}

