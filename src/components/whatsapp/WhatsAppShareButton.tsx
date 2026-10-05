/**
 * Botão reutilizável "Enviar pelo WhatsApp" (link wa.me).
 * `mensagem` pode ser função para montar o texto só no clique.
 */
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/utils/whatsapp";

interface Props {
  telefone?: string | null;
  mensagem: string | (() => string);
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  /** Sem telefone: abre o WhatsApp para escolher o contato manualmente. */
  permitirSemTelefone?: boolean;
}

export default function WhatsAppShareButton({
  telefone, mensagem, label = "WhatsApp", size = "sm", variant = "outline", className, permitirSemTelefone = true,
}: Props) {
  const enviar = () => {
    const texto = typeof mensagem === "function" ? mensagem() : mensagem;
    if (!telefone && !permitirSemTelefone) {
      toast.error("Nenhum telefone cadastrado.");
      return;
    }
    if (!abrirWhatsApp(telefone || null, texto)) {
      toast.error("Telefone inválido para WhatsApp. Verifique DDD e número.");
    }
  };
  return (
    <Button type="button" size={size} variant={variant} className={className} onClick={enviar} title="Enviar pelo WhatsApp">
      <MessageCircle className={label && size !== "icon" ? "h-4 w-4 mr-1" : "h-4 w-4"} />
      {size !== "icon" && label}
    </Button>
  );
}
