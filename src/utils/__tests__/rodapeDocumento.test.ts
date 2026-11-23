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
    expect(html).toContain('Documento AUTÊNTICO assinado eletronicamente por:');
    expect(html).toContain('horário oficial de Brasília');
    expect(html).toContain('05/10/2026');
    expect(html).toContain('(horário oficial de Brasília)');
  });

  it('normaliza o SHA-256 e cria código numérico de 8 dígitos para documentos legados', () => {
    expect(normalizarHashDocumento(' abcd12 ')).toBe('ABCD12');
    expect(codigoVerificadorDoHash('a'.repeat(64))).toMatch(/^\d{8}$/);
  });
});
import { mascararCpf, textoAssinaturas } from '../rodapeDocumento';

describe('assinatura no mesmo rodapé da autenticidade', () => {
  const selo = { id: '12345678', hash: 'a'.repeat(64), urlVerificacao: 'https://senexcare.app/verificar-documento?id=12345678', qrDataUrl: 'data:image/png;base64,AA==' };

  it('mascara o CPF mantendo só os dígitos centrais', () => {
    expect(mascararCpf('123.456.789-01')).toBe('***.456.789-**');
    expect(mascararCpf('123')).toBeNull();
  });

  it('informa autenticidade, nome, cargo, CPF, horário de Brasília e local', () => {
    const t = textoAssinaturas([{ nome: 'Maria Silva', papel: 'Cuidadora', cpf: '12345678901', local: 'Porto Alegre/RS', assinadoEm: '2026-11-23T17:17:00Z' }]);
    expect(t).toContain('AUTÊNTICO');
    expect(t).toContain('Maria Silva, Cuidadora, CPF ***.456.789-**, em 23/11/2026 às 14:17 (horário oficial de Brasília), Porto Alegre/RS');
  });

  it('coloca todos os signatários em um único rodapé com um único QR Code', () => {
    const html = rodapeDocumentoHTML(selo, [
      { nome: 'Ana', papel: 'Gestora', assinadoEm: '2026-11-23T17:00:00Z' },
      { nome: 'Bruno', papel: 'Contratante', assinadoEm: '2026-11-23T17:05:00Z' },
    ]);
    expect(html.match(/class="autenticidade"/g)).toHaveLength(1);
    expect(html.match(/QR Code de verificação/g)).toHaveLength(1);
    expect(html).toContain('Ana, Gestora');
    expect(html).toContain('Bruno, Contratante');
  });
});
