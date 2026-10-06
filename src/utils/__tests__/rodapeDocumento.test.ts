import { describe, expect, it } from 'vitest';
import { codigoVerificadorDoHash, normalizarHashDocumento, rodapeDocumentoHTML } from '../rodapeDocumento';

describe('rodapé de autenticidade', () => {
  it('exibe dados reais sem alegar assinatura e escapa campos inseridos', () => {
    const html = rodapeDocumentoHTML({
      id: '42486962', hash: 'a'.repeat(64),
      urlVerificacao: 'https://exemplo.com/?id=123&hash=abc',
      qrDataUrl: 'data:image/png;base64,abc',
    });
    expect(html).toContain('código verificador <strong>42486962</strong>');
    expect(html).toContain('QR Code de verificação');
    expect(html).toContain('&amp;hash=abc');
    expect(html).not.toContain('assinado eletronicamente');
    expect(html).toContain('SXCare assinatura eletrônica');
    expect(html).toContain('não representa assinatura eletrônica');
  });

  it('identifica o signatário e o horário oficial quando existe assinatura', () => {
    const html = rodapeDocumentoHTML({
      id: 'DOC-456', hash: 'b'.repeat(64),
      urlVerificacao: 'https://exemplo.com/verificar',
      qrDataUrl: 'data:image/png;base64,abc',
    }, {
      nome: 'Maria da Silva', papel: 'Colaboradora',
      metodo: 'Biometria facial', assinadoEm: '2026-10-05T13:30:00Z',
    });
    expect(html).toContain('Documento assinado eletronicamente por <strong>Maria da Silva</strong>');
    expect(html).toContain('horário oficial de Brasília');
    expect(html).toContain('Biometria facial');
    expect(html).toContain('05/10/2026');
    expect(html).toContain('conforme horário oficial de Brasília');
  });

  it('normaliza o SHA-256 e cria código numérico de 8 dígitos para documentos legados', () => {
    expect(normalizarHashDocumento(' abcd12 ')).toBe('ABCD12');
    expect(codigoVerificadorDoHash('a'.repeat(64))).toMatch(/^\d{8}$/);
  });
});