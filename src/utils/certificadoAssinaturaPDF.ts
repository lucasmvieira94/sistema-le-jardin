/**
 * Gera o "Manifesto de Assinaturas" (certificado de conclusão) em PDF.
 *
 * O manifesto é a peça probatória do documento eletrônico: reúne o hash de
 * integridade, a identificação dos signatários e as evidências de autoria
 * (data/hora UTC-3, IP, dispositivo, método de confirmação e geolocalização),
 * conforme MP 2.200-2/2001 art. 10, §2º e Lei 14.063/2020.
 */
import jsPDF from 'jspdf';
import type { Envelope } from '@/hooks/useAssinaturas';
import { METODO_LABEL, STATUS_LABEL, TIPO_LABEL } from '@/hooks/useAssinaturas';

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (UTC-3)'
    : '—';

export function gerarCertificadoAssinaturas(envelope: Envelope) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 18;
  const W = 210 - M * 2;
  let y = M;

  const linha = () => {
    doc.setDrawColor(180);
    doc.line(M, y, M + W, y);
    y += 5;
  };

  const texto = (label: string, valor: string, size = 9) => {
    doc.setFont('times', 'bold').setFontSize(size);
    const lw = doc.getTextWidth(`${label} `);
    doc.text(`${label} `, M, y);
    doc.setFont('times', 'normal');
    const linhas = doc.splitTextToSize(valor || '—', W - lw);
    doc.text(linhas, M + lw, y);
    y += linhas.length * (size * 0.42) + 1.5;
  };

  const quebrar = (necessario = 30) => {
    if (y > 297 - M - necessario) {
      doc.addPage();
      y = M;
    }
  };

  doc.setFont('times', 'bold').setFontSize(15);
  doc.text('MANIFESTO DE ASSINATURAS ELETRÔNICAS', 105, y, { align: 'center' });
  y += 7;
  doc.setFont('times', 'normal').setFontSize(9);
  doc.text('MP 2.200-2/2001, art. 10, §2º • Lei 14.063/2020', 105, y, { align: 'center' });
  y += 8;
  linha();

  texto('Documento:', envelope.titulo, 11);
  texto('Tipo:', TIPO_LABEL[envelope.tipo] ?? envelope.tipo);
  texto('Situação:', STATUS_LABEL[envelope.status] ?? envelope.status);
  texto('Criado em:', fmt(envelope.created_at));
  texto('Concluído em:', fmt(envelope.concluido_em));
  texto('Hash SHA-256 do conteúdo:', envelope.hash_documento);
  y += 2;
  linha();

  doc.setFont('times', 'bold').setFontSize(12);
  doc.text('SIGNATÁRIOS E EVIDÊNCIAS', M, y);
  y += 6;

  const signatarios = [...(envelope.assinatura_signatarios ?? [])].sort((a, b) => a.ordem - b.ordem);
  signatarios.forEach((s, i) => {
    quebrar(46);
    doc.setFont('times', 'bold').setFontSize(10);
    doc.text(`${i + 1}. ${s.nome} — ${s.papel}`, M, y);
    y += 5;
    texto('CPF:', s.cpf || 'não informado');
    texto('Contato:', [s.email, s.telefone].filter(Boolean).join(' • ') || '—');
    texto('Método de confirmação:', METODO_LABEL[s.metodo] ?? s.metodo);
    texto('Situação:', STATUS_LABEL[s.status] ?? s.status);
    texto('Assinado em:', fmt(s.assinado_em));
    texto('IP de origem:', s.ip_origem || '—');
    texto('Dispositivo:', s.user_agent || '—');
    if (s.geolocalizacao?.latitude) {
      texto('Geolocalização:', `${s.geolocalizacao.latitude}, ${s.geolocalizacao.longitude}`);
    }
    if (s.motivo_recusa) texto('Motivo da recusa:', s.motivo_recusa);
    texto('Hash da assinatura:', s.hash_assinatura || '—');
    y += 2;
    linha();
  });

  quebrar(26);
  doc.setFont('times', 'italic').setFontSize(8);
  const nota = doc.splitTextToSize(
    'Este manifesto integra o documento eletrônico e comprova sua autoria e integridade. ' +
      'Qualquer alteração no conteúdo original invalida o hash SHA-256 registrado acima. ' +
      'As evidências foram coletadas e armazenadas em conformidade com a LGPD (Lei 13.709/2018).',
    W,
  );
  doc.text(nota, M, y);

  doc.save(`manifesto-assinaturas-${envelope.id.slice(0, 8)}.pdf`);
}
