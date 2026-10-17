import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { emailResidencial, fichaConcluida } from './regras.ts';
import { gerarFichaPDF } from './pdf.ts';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.test('somente fichas preenchidas e aprovadas são enviadas', () => {
  assertEquals(fichaConcluida('pendente'), false);
  assertEquals(fichaConcluida('preenchida'), true);
  assertEquals(fichaConcluida('aprovada'), true);
});
Deno.test('destino é o e-mail do residencial salvo em configurações', () => {
  assertEquals(emailResidencial(' lejardinresidencial.senior@gmail.com '), 'lejardinresidencial.senior@gmail.com');
  assertThrows(() => emailResidencial(''), Error);
  assertThrows(() => emailResidencial('senexcare.app'), Error);
});
Deno.test('documento contém páginas PDF reais para todas as respostas longas', async () => {
  const bytes = gerarFichaPDF({status:'preenchida', historico_saude:{doencas_previas:'Histórico clínico extenso. '.repeat(1000)}}, 'Residente', {nome_empresa:'Residencial'});
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount() > 1, true);
});