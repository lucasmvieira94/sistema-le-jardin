import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filtrarFichaRosa,moduloFerramenta } from './conhecimento.ts';
Deno.test('Rosa não retorna medicamentos sem permissão do módulo',()=>{assertEquals(filtrarFichaRosa({residente:{nome:'Teste'},medicamentos:['x']},['portal_cuidados']),{residente:{nome:'Teste'}});});
Deno.test('Rosa não retorna prontuários sem permissão do módulo',()=>{assertEquals(filtrarFichaRosa({prontuarios:['x']},['portal_cuidados']),{});});
Deno.test('Rosa não retorna vacinas sem permissão do módulo',()=>{assertEquals(filtrarFichaRosa({vacinas:['x']},['portal_cuidados']),{});});
Deno.test('consulta diária exige prontuário',()=>{assertEquals(moduloFerramenta('prontuario_dia'),'prontuario');});