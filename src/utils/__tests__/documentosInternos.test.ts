import { describe, it, expect } from 'vitest';
import {
  conteudoCanonico, filtrarDocumentos, podeIndicarTestemunhas, resumirDocumentos, rotuloRecusa, sha256Hex,
  textoTermo, validarMotivoRecusa, type DocumentoFuncionario,
} from '../documentosInternos';

const doc = (p: Partial<DocumentoFuncionario>): DocumentoFuncionario => ({
  tipo_documento: 'comunicado', referencia_id: Math.random().toString(), titulo: 'T', subtitulo: null,
  conteudo_html: null, arquivo_path: null, hash_referencia: null, criado_em: '2026-01-01T00:00:00Z',
  status: 'pendente', assinado_em: null, motivo_recusa: null, hash_assinatura: null, hash_documento: null, ...p,
});

describe('documentosInternos', () => {
  it('calcula SHA-256 conhecido', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('gera conteúdo canônico estável', () => {
    expect(conteudoCanonico({ titulo: ' A ', conteudo_html: ' <p>x</p> ' })).toBe('A\n<p>x</p>');
    expect(conteudoCanonico({ titulo: 'A', conteudo_html: null })).toBe('A\n');
  });

  it('exige motivo de recusa com 5 caracteres', () => {
    expect(validarMotivoRecusa('  abc ')).not.toBeNull();
    expect(validarMotivoRecusa('horário errado')).toBeNull();
  });

  it('termo de advertência deixa claro que é ciência, não concordância', () => {
    expect(textoTermo('advertencia')).toMatch(/não concordância/);
    expect(rotuloRecusa('folha_ponto')).toBe('Discordo dos registros');
  });

  it('resume e filtra com pendentes primeiro', () => {
    const lista = [
      doc({ status: 'assinado', criado_em: '2026-03-01' }),
      doc({ status: 'pendente', criado_em: '2026-01-01' }),
      doc({ status: 'recusado', criado_em: '2026-02-01' }),
      doc({ status: 'pendente', criado_em: '2026-02-15' }),
    ];
    expect(resumirDocumentos(lista)).toEqual({ pendentes: 2, assinados: 1, recusados: 1, total: 4 });
    expect(filtrarDocumentos(lista, 'pendentes').map((d) => d.criado_em)).toEqual(['2026-02-15', '2026-01-01']);
    expect(filtrarDocumentos(lista, 'concluidos')).toHaveLength(2);
    expect(filtrarDocumentos(lista, 'todos').map((d) => d.status)).toEqual(['pendente', 'pendente', 'assinado', 'recusado']);
  });

  it('testemunha tem termo próprio, deixando claro que a medida não é para ela', () => {
    expect(textoTermo('advertencia_testemunha')).toMatch(/TESTEMUNHA/);
    expect(textoTermo('advertencia_testemunha')).toMatch(/não se aplica a mim/);
    expect(rotuloRecusa('advertencia_testemunha')).toBe('Não posso testemunhar');
  });

  describe('podeIndicarTestemunhas', () => {
    const agora = new Date('2026-10-10T12:00:00Z').getTime();
    const adv = { tipo_documento: 'advertencia', prazo_em: '2026-10-08T12:00:00Z' };
    it('libera após o prazo de 3 dias sem assinatura', () => {
      expect(podeIndicarTestemunhas({ ...adv, status: 'pendente' }, false, agora)).toBe(true);
    });
    it('não libera antes do prazo', () => {
      expect(podeIndicarTestemunhas({ ...adv, status: 'pendente', prazo_em: '2026-10-11T12:00:00Z' }, false, agora)).toBe(false);
    });
    it('libera imediatamente quando o colaborador recusa', () => {
      expect(podeIndicarTestemunhas({ ...adv, status: 'recusado', prazo_em: '2026-10-11T12:00:00Z' }, false, agora)).toBe(true);
    });
    it('não libera se já assinou, se já há testemunhas ou se não é advertência', () => {
      expect(podeIndicarTestemunhas({ ...adv, status: 'assinado' }, false, agora)).toBe(false);
      expect(podeIndicarTestemunhas({ ...adv, status: 'recusado' }, true, agora)).toBe(false);
      expect(podeIndicarTestemunhas({ ...adv, tipo_documento: 'folha_ponto', status: 'pendente' }, false, agora)).toBe(false);
    });
  });
});
