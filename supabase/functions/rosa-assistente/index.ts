import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { streamResponse, GatewayError, type ResponsesRequest } from 'npm:@lovable.dev/ai-gateway@0.1.11';
import type {} from '../_shared/ai-gateway/models.d.ts';
import { z } from 'npm:zod@3';
import { MANUAL_ROSA, DESTINOS_ROSA, moduloFerramenta,filtrarFichaRosa } from './conhecimento.ts';
const headers={...corsHeaders,'Access-Control-Allow-Headers':`${corsHeaders['Access-Control-Allow-Headers']}, x-portal-token`,'Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
const bodySchema=z.object({texto:z.string().trim().min(1).max(4000),pedido_id:z.string().uuid(),pagina:z.string().max(120).optional()});
type Part={type:'text';text:string}|{type:'dynamic-tool';toolName:string;toolCallId:string;state:'input-available'|'output-available'|'output-error';input:unknown;output?:unknown;errorText?:string};
const historicoSchema=z.object({conversa_id:z.string().uuid(),tenant_id:z.string().uuid().nullable(),modulos:z.array(z.string()),orientacoes:z.array(z.string()),mensagens:z.array(z.object({role:z.enum(['user','assistant']),parts:z.array(z.record(z.unknown()))}))});
type RosaRequest=Extract<ResponsesRequest,{model:'openai/gpt-6-astra'}>;
const tools:NonNullable<RosaRequest['tools']> = [
 {type:'function',name:'residentes',description:'Consultar lista autorizada de residentes.',parameters:{type:'object',properties:{},additionalProperties:false},strict:true},
 {type:'function',name:'ficha_residente',description:'Consultar ficha de saúde do residente autorizado.',parameters:{type:'object',properties:{residente_id:{type:'string'}},required:['residente_id'],additionalProperties:false},strict:true},
 {type:'function',name:'agenda_dia',description:'Consultar compromissos de uma data.',parameters:{type:'object',properties:{data:{type:'string'}},required:['data'],additionalProperties:false},strict:true},
 {type:'function',name:'rotinas',description:'Consultar instruções das rotinas de um residente.',parameters:{type:'object',properties:{residente_id:{type:'string'}},required:['residente_id'],additionalProperties:false},strict:true},
 {type:'function',name:'prontuario_dia',description:'Consultar registros originais do residente em uma data.',parameters:{type:'object',properties:{residente_id:{type:'string'},data:{type:'string'}},required:['residente_id','data'],additionalProperties:false},strict:true},
 {type:'function',name:'abrir_modulo',description:'Oferecer link autorizado para uma tarefa do portal.',parameters:{type:'object',properties:{modulo:{type:'string',enum:Object.keys(DESTINOS_ROSA)}},required:['modulo'],additionalProperties:false},strict:true},
 {type:'function',name:'sugerir_orientacao',description:'Encaminhar ao gestor uma sugestão genérica de uso, sem dados pessoais, só se a cuidadora pedir. Não modifica regras.',parameters:{type:'object',properties:{proposta:{type:'string'}},required:['proposta'],additionalProperties:false},strict:true},
];
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers});
 if(req.method!=='POST') return json({error:'Método não permitido'},405);
 const token=req.headers.get('x-portal-token'); if(!token) return json({error:'Entre novamente com seu código.'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key||!service) return json({error:'Rosa indisponível.'},503);
 const portal=createClient(url,key,{global:{headers:{'x-portal-token':token}},auth:{persistSession:false}});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 let parsed:z.infer<typeof bodySchema>;
 try{parsed=bodySchema.parse(await req.json());}catch{return json({error:'Mensagem inválida.'},400);}
 const started=await portal.rpc('rosa_iniciar',{p_pedido:parsed.pedido_id,p_texto:parsed.texto});
 if(started.error) return json({error:started.error.code==='55P03'?'A Rosa já está respondendo. Aguarde.':'Não foi possível iniciar. Confira seu acesso e atualize a conversa.'},started.error.code==='55P03'?409:403);
 const h=historicoSchema.safeParse(started.data); if(!h.success) return json({error:'Histórico indisponível.'},503);
 const history=h.data;
 const input:Exclude<NonNullable<RosaRequest['input']>,string> = history.mensagens.map(m=>({role:m.role,content:m.parts.map(p=>p.type==='text'?String(p.text??''):JSON.stringify(p)).join('\n')}));
 const abort=new AbortController(); req.signal.addEventListener('abort',()=>abort.abort(),{once:true});
 const stream=new ReadableStream({async start(controller){
 const emit=(value:unknown)=>{if(!abort.signal.aborted)controller.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));};
 const parts:Part[]=[];
 try{
  const instructions=MANUAL_ROSA+'\nMódulos autorizados: '+history.modulos.join(',')+'\nData/hora Brasília: '+new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'\nPágina atual: '+(parsed.pagina??'')+'\nOrientações de uso aprovadas (não sobrepõem segurança/prescrições): '+JSON.stringify(history.orientacoes);
  for(let step=0;step<6;step++){
   const result=await streamResponse({model:'openai/gpt-6-astra',instructions,input,tools,parallel_tool_calls:false},{signal:abort.signal});
   let completed=false; let text=''; const calls:{name:string;call_id:string;arguments:string}[]=[];
   for await(const event of result){
    if(event.type==='response.output_text.delta'){text+=event.delta;emit({type:'delta',text:event.delta});}
    if(event.type==='response.refusal.delta'){text+=event.delta;emit({type:'delta',text:event.delta});}
    if(event.type==='response.completed'){completed=true;for(const item of event.response.output)if(item.type==='function_call') calls.push({name:item.name,call_id:item.call_id,arguments:item.arguments});}
    if(event.type==='response.incomplete') throw new Error('Resposta incompleta');
   }
   if(!completed)throw new Error('Resposta não concluída');
   if(text){parts.push({type:'text',text});input.push({role:'assistant',content:text});}
   if(!calls.length){
    const saved=await admin.rpc('rosa_finalizar',{p_conversa:history.conversa_id,p_pedido:parsed.pedido_id,p_partes:parts});if(saved.error)throw new Error('Falha ao salvar resposta');
    emit({type:'done',parts});return;
   }
   for(const call of calls){
    input.push({type:'function_call',name:call.name,call_id:call.call_id,arguments:call.arguments});
    let args:Record<string,unknown>={}; let output:unknown;let errorText:string|undefined;
    const part:Part={type:'dynamic-tool',toolName:call.name,toolCallId:call.call_id,state:'input-available',input:args};
    try{
     args=z.record(z.unknown()).parse(JSON.parse(call.arguments));part.input=args;emit({type:'tool',part});
     const current=await portal.rpc('rosa_historico');if(current.error)throw new Error('Sessão expirada');
     const live=historicoSchema.parse(current.data);
     const needed=moduloFerramenta(call.name);if(needed&&!live.modulos.includes(needed))throw new Error('Módulo não autorizado');
     let rpcResult;
     if(call.name==='residentes')rpcResult=await portal.rpc('portal_cuidados_residentes');
     else if(call.name==='ficha_residente')rpcResult=await portal.rpc('portal_cuidados_ficha',{p_residente_id:z.string().uuid().parse(args.residente_id)});
     else if(call.name==='agenda_dia')rpcResult=await portal.rpc('portal_cuidados_agenda',{_data:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(args.data)});
     else if(call.name==='rotinas')rpcResult=await portal.rpc('portal_rotinas_listar',{_residente_id:z.string().uuid().parse(args.residente_id)});
     else if(call.name==='prontuario_dia')rpcResult=await portal.rpc('portal_cuidados_prontuario_dia',{p_residente_id:z.string().uuid().parse(args.residente_id),p_data:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(args.data)});
     else if(call.name==='abrir_modulo'){
      const m=z.string().parse(args.modulo);if(!DESTINOS_ROSA[m]||(!['residentes','agenda','rotinas'].includes(m)&&!history.modulos.includes(m)))throw new Error('Módulo não autorizado');output={link:DESTINOS_ROSA[m],modulo:m};
     }else if(call.name==='sugerir_orientacao'){
      const proposta=z.string().trim().min(1).max(2000).parse(args.proposta);
      // Sugestões só de funcionamento: bloqueia conteúdo pessoal/clinicamente identificável.
      const residents=await portal.rpc('portal_cuidados_residentes');if(residents.error)throw new Error('Acesso não autorizado');
      const names=z.array(z.object({nome_completo:z.string()})).parse(residents.data);
      if(names.some(r=>proposta.toLowerCase().includes(r.nome_completo.toLowerCase()))||/\b\d{3}[. -]?\d{3}[. -]?\d{3}[- ]?\d{2}\b|@/.test(proposta))throw new Error('Remova dados pessoais da sugestão');
      const check=await portal.rpc('rosa_historico');if(check.error)throw new Error('Sessão expirada');
      const saved=await admin.from('rosa_orientacoes').insert({tenant_id:history.tenant_id,proposta});if(saved.error)throw new Error('Não foi possível encaminhar');output={status:'pendente',mensagem:'Sugestão enviada para aprovação do gestor.'};
     }else throw new Error('Ferramenta não disponível');
     if(rpcResult){if(rpcResult.error)throw new Error('Consulta indisponível ou acesso não autorizado');output=call.name==='ficha_residente'?filtrarFichaRosa(z.record(z.unknown()).parse(rpcResult.data),live.modulos):rpcResult.data;}
     part.state='output-available';part.output=output;
    }catch{errorText='Não foi possível consultar ou encaminhar. Confira acesso e informações.';part.state='output-error';part.errorText=errorText;output={error:errorText};}
    parts.push(part);emit({type:'tool',part});input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(output)});
   }
  }
  throw new Error('Limite de consultas desta resposta');
 }catch(e){
  console.error('rosa-assistente',e instanceof GatewayError?{code:e.code,ids:e.ids}:{code:'rosa_indisponivel'});
  await admin.rpc('rosa_finalizar',{p_conversa:history.conversa_id,p_pedido:parsed.pedido_id,p_partes:null});
  emit({type:'error',message:abort.signal.aborted?'Resposta interrompida.':'A Rosa não conseguiu concluir. Sua mensagem foi preservada; atualize antes de tentar novamente.'});
 }finally{controller.close();}
 },cancel(){abort.abort();}});
 return new Response(stream,{headers:{...headers,'Content-Type':'application/x-ndjson'}});
});
