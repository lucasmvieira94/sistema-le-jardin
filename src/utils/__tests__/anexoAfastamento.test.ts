import { describe, expect, it } from 'vitest';
import { textoParaPdf, validarAnexo } from '../anexoAfastamento';

describe('anexo de afastamento', () => {
  it.each(['png', 'jpeg', 'heic', 'svg', 'tiff', 'pdf', 'docx', 'odt', 'txt', 'rtf'])(
    'aceita %s para conversão em PDF',
    ext => {
      expect(validarAnexo(new File(['arquivo'], `comprovante.${ext}`))).toBe(ext);
    },
  );

  it('recusa arquivo vazio ou maior que 20 MB', () => {
    expect(() => validarAnexo(new File([], 'vazio.pdf'))).toThrow('20 MB');
    expect(() => validarAnexo(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'grande.pdf'))).toThrow('20 MB');
  });

  it('recusa formatos não suportados', () => {
    expect(() => validarAnexo(new File(['x'], 'comprovante.exe'))).toThrow('Formato não aceito');
    expect(() => validarAnexo(new File(['x'], 'comprovante.doc'))).toThrow('Formato não aceito');
  });

  it('gera um PDF válido a partir do texto extraído', async () => {
    const pdf = textoParaPdf('Atestado médico\n\nAfastamento de 3 dias.', 'atestado');
    expect(pdf.type).toBe('application/pdf');
    expect(await pdf.slice(0, 5).text()).toBe('%PDF-');
  });
});
