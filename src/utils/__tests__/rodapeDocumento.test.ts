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
  });
});