import { Navigate } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthSession();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
