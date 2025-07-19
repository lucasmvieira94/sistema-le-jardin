
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    
    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Login realizado!",
        description: "",
      });
      navigate("/");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form 
        onSubmit={handleLogin} 
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 flex flex-col gap-5"
      >
        <h2 className="text-2xl font-bold text-primary">
          Entrar
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
            autoComplete="current-password"
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
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
