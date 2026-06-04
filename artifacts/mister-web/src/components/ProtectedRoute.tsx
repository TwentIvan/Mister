import { useCurrentUser } from "@/contexts/AuthContext";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Reindirizza a /login se l'utente non è autenticato.
 * Mostra nulla durante il caricamento iniziale.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;

  return <>{children}</>;
}
