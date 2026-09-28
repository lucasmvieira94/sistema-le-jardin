import { describe, expect, it } from 'vitest';
import { validarAnexo } from '../anexoAfastamento';

describe('anexo de afastamento', () => {
  it.each(['png', 'jpeg', 'heic', 'svg', 'tiff', 'pdf', 'doc', 'docx', 'odt'])(
    'aceita %s para conversão em PDF', ext => {
      expect(validarAnexo(new File(['arquivo'], `comprovante.${ext}`))).toBe(ext);
    },
  );

  it('recusa arquivo vazio ou maior que 20 MiB', () => {
    expect(() => validarAnexo(new File([], 'vazio.pdf'))).toThrow('20 MB');
    expect(() => validarAnexo(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'grande.pdf'))).toThrow('20 MB');
  });

  it('recusa extensões não suportadas', () => {
    expect(() => validarAnexo(new File(['texto'], 'comprovante.exe'))).toThrow('Formato não aceito');
  });
});