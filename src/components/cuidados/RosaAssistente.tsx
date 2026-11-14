import { useEffect, useRef, useState } from 'react';
import type { UIMessage, ChatStatus } from 'ai';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lerPasse } from '@/utils/portalSessao';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Tool, ToolHeader, ToolContent, ToolOutput } from '@/components/ai-elements/tool';
import { Shimmer } from '@/components/ai-elements/shimmer';
import rosa from '@/assets/rosa-assistente.jpg';
import { z } from 'zod';

const partSchema = z.union([z.object({type:z.literal('text'),text:z.string()}),z.object({type:z.literal('dynamic-tool'),toolName:z.string(),toolCallId:z.string(),state:z.enum(['input-available','output-available','output-error']),input:z.unknown(),output:z.unknown().optional(),errorText:z.string().optional()})]);
const historySchema=z.object({mensagens:z.array(z.object({id:z.string(),role:z.enum(['user','assistant']),parts:z.array(partSchema)}))});
const eventSchema=z.discriminatedUnion('type',[z.object({type:z.literal('delta'),text:z.string()}),z.object({type:z.literal('tool'),part:partSchema}),z.object({type:z.literal('done'),parts:z.array(partSchema)}),z.object({type:z.literal('error'),message:z.string()})]);
const names:Record<string,string>={residentes:'Residentes',ficha_residente:'Ficha do residente',agenda_dia:'Agenda do dia',rotinas:'Rotinas',prontuario_dia:'Prontuário do dia',abrir_modulo:'Abrir tarefa',sugerir_orientacao:'Sugestão ao gestor'};

export default function RosaAssistente(){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<UIMessage[]>([]),[status,setStatus]=useState<ChatStatus>('ready'),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[text,setText]=useState('');
 const location=useLocation(); const textarea=useRef<HTMLTextAreaElement>(null),abort=useRef<AbortController|null>(null);
 const busy=status==='submitted'||status==='streaming';
 async function load(){setError('');setLoaded(false);const result=await supabase.rpc('rosa_historico');if(result.error){setError('Não foi possível abrir a conversa. Confira sua sessão.');return;}const parsed=historySchema.safeParse(result.data);if(!parsed.success){setError('Histórico indisponível.');return;}setMessages(parsed.data.mensagens);setLoaded(true);}
 useEffect(()=>{if(open)void load();},[open]);
 useEffect(()=>{if(open&&loaded&&!busy)textarea.current?.focus();},[open,loaded,busy]);
 useEffect(()=>()=>abort.current?.abort(),[]);
 async function send(value:string){
  if(busy||!loaded||!value.trim())return;const token=lerPasse()?.token;if(!token){setError('Entre novamente com seu código.');return;}
  const pedido=crypto.randomUUID(),assistant=crypto.randomUUID();setText('');setError('');setStatus('submitted');textarea.current?.focus();
  setMessages(old=>[...old,{id:pedido,role:'user',parts:[{type:'text',text:value.trim()}]},{id:assistant,role:'assistant',parts:[]}]);
  const controller=new AbortController();abort.current=controller;
  try{
   const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rosa-assistente`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,'x-portal-token':token},body:JSON.stringify({texto:value.trim(),pedido_id:pedido,pagina:location.pathname}),signal:controller.signal});
   if(!response.ok||!response.body)throw new Error('Não foi possível conversar com a Rosa. Atualize a conversa antes de tentar novamente.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',completed=false;
   while(true){const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:!chunk.done});const lines=buffer.split('\n');buffer=lines.pop()??'';
    for(const line of lines){if(!line.trim())continue;const event=eventSchema.parse(JSON.parse(line));if(event.type==='error')throw new Error(event.message);
     setStatus('streaming');if(event.type==='done')completed=true;
     setMessages(old=>old.map(m=>{if(m.id!==assistant)return m;
      if(event.type==='done')return {...m,parts:event.parts};
      if(event.type==='tool'&&event.part.type==='dynamic-tool'){const part=event.part;return {...m,parts:[...m.parts.filter(p=>p.type!=='dynamic-tool'||p.toolCallId!==part.toolCallId),part]};}
      if(event.type==='delta'){const last=m.parts[m.parts.length-1];return {...m,parts:last?.type==='text'?[...m.parts.slice(0,-1),{type:'text',text:last.text+event.text}]:[...m.parts,{type:'text',text:event.text}]};}return m;}));
    }if(chunk.done)break;
   }if(!completed)throw new Error('Resposta interrompida. Atualize para conferir o histórico.');setStatus('ready');
  }catch(e){setError(controller.signal.aborted?'Resposta interrompida; a mensagem permanece no histórico.':e instanceof Error?e.message:'Rosa indisponível.');setStatus('error');setText(value);}
  finally{abort.current=null;textarea.current?.focus();}
 }
 return <>
  <Button variant="secondary" size="sm" onClick={()=>setOpen(true)} aria-label="Conversar com Rosa"><img src={rosa} width={28} height={28} loading="lazy" alt="" className="h-7 w-7 rounded-full"/>Rosa</Button>
  <Dialog open={open} onOpenChange={value=>{if(!value)abort.current?.abort();setOpen(value);}}>
   <DialogContent className="flex h-[85dvh] max-h-[850px] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0">
    <DialogHeader className="border-b px-5 py-4 pr-12"><DialogTitle className="flex items-center gap-3"><img src={rosa} alt="Rosa" width={44} height={44} className="h-11 w-11 rounded-full"/><span>Rosa<span className="block text-xs font-normal text-muted-foreground">Assistente de cuidados · Conversa privada</span></span></DialogTitle></DialogHeader>
    <Conversation className="min-h-0 flex-1"><ConversationContent className="gap-4 p-4">
     {loaded&&!messages.length&&<Message from="assistant"><MessageContent><MessageResponse>Olá! Sou a Rosa. Como posso ajudar nos cuidados de hoje?</MessageResponse></MessageContent></Message>}
     {messages.map(m=><Message key={m.id} from={m.role}><MessageContent className={m.role==='user'?'bg-primary text-primary-foreground':'bg-transparent'}>{m.parts.map((p,i)=>p.type==='text'?<MessageResponse key={i}>{p.text}</MessageResponse>:p.type==='dynamic-tool'?<Tool key={p.toolCallId} defaultOpen={false}><ToolHeader type="dynamic-tool" toolName={p.toolName} state={p.state} title={names[p.toolName]??'Consulta'}/><ToolContent><ToolOutput output={p.output} errorText={p.errorText}/></ToolContent></Tool>:null)}</MessageContent></Message>)}
     {status==='submitted'&&<Shimmer>Rosa está consultando…</Shimmer>}
    </ConversationContent><ConversationScrollButton/></Conversation>
    {error&&<div role="alert" className="border-t px-4 py-2 text-sm text-destructive">{error}<Button variant="link" size="sm" disabled={busy} onClick={()=>void load()}>Atualizar conversa</Button></div>}
    <div className="border-t p-3"><PromptInput onSubmit={m=>send(m.text)}><PromptInputTextarea ref={textarea} value={text} onChange={e=>setText(e.target.value)} maxLength={4000} placeholder="Pergunte à Rosa…" aria-label="Mensagem para Rosa" className="min-h-20"/><PromptInputFooter className="justify-end"><PromptInputSubmit status={status} disabled={!loaded||(!busy&&!text.trim())} onStop={()=>abort.current?.abort()} aria-label={busy?'Interromper resposta':'Enviar mensagem'} /></PromptInputFooter></PromptInput></div>
   </DialogContent>
  </Dialog>
 </>;
}