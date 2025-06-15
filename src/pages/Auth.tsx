
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redireciona se já estiver logado (handled no App). Esta página só aparece se NÃO autenticado.

  async function handleAuthForm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let error = null;
    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      error = err;
    }
    if (mode === "signup") {
      // IMPORTANTE: Supabase best practice - sempre setar o redirectTo.
      const redirectUrl = window.location.origin + "/";
      const { error: err } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      error = err;
    }
    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: mode === "login" ? "Login realizado!" : "Cadastro realizado!",
        description: mode === "signup" ? "Cheque seu e-mail para confirmar o cadastro." : "",
      });
      // O Supabase não ativa a sessão enquanto não confirmar o email no modo signup.
      if (mode === "login") {
        navigate("/");
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form 
        onSubmit={handleAuthForm} 
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 flex flex-col gap-5"
      >
        <h2 className="text-2xl font-bold text-primary">
          {mode === "login" ? "Entrar" : "Cadastrar"}
        </h2>
        <label>
          <span className="font-semibold text-sm text-muted-foreground">E-mail</span>
          <Input 
            type="email" 
            value={email} 
            autoComplete="username"
            onChange={e => setEmail(e.target.value)} 
            required 
            className="mt-1"
          />
        </label>
        <label>
          <span className="font-semibold text-sm text-muted-foreground">Senha</span>
          <Input 
            type="password" 
            value={senha} 
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onChange={e => setSenha(e.target.value)} 
            required 
            minLength={6}
            className="mt-1"
          />
        </label>
        <Button 
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading
            ? (mode === "login" ? "Entrando..." : "Cadastrando...")
            : (mode === "login" ? "Entrar" : "Cadastrar")}
        </Button>
        <button
          type="button"
          className="text-sm text-primary underline hover:opacity-80 mt-1"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login"
            ? "Não tem conta? Cadastrar"
            : "Já tem conta? Entrar"}
        </button>
      </form>
    </div>
  );
}
