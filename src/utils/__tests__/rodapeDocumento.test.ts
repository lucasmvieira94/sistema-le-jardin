import { describe, expect, it } from 'vitest';
import { rodapeDocumentoHTML } from '../rodapeDocumento';

describe('rodapé de autenticidade', () => {
  it('exibe dados reais sem alegar assinatura e escapa campos inseridos', () => {
    const html = rodapeDocumentoHTML({
      id: '123', hash: 'a'.repeat(64),
      urlVerificacao: 'https://exemplo.com/?id=123&hash=abc',
      qrDataUrl: 'data:image/png;base64,abc',
    });
    expect(html).toContain('Código verificador:</strong> 123');
    expect(html).toContain('QR Code de verificação');
    expect(html).toContain('&amp;hash=abc');
    expect(html).not.toContain('assinado eletronicamente');
    expect(html).toContain('SenexCare');
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
  });
});