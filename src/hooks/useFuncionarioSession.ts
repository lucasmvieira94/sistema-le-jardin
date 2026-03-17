import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SESSION_KEY = 'funcionario_session';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 horas

/**
 * Verifica se a sessão do funcionário (código de 4 dígitos) ainda é válida.
 * Redireciona para "/" se expirada.
 */
export function useFuncionarioSession() {
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) {
          navigate('/', { replace: true });
          return;
        }
        const session = JSON.parse(raw);
        if (Date.now() - session.timestamp > SESSION_DURATION) {
          sessionStorage.removeItem(SESSION_KEY);
          navigate('/', { replace: true });
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        navigate('/', { replace: true });
      }
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [navigate]);
}
