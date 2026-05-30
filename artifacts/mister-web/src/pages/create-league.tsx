import { useEffect } from "react";
import { useLocation } from "wouter";

export default function CreateLeague() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/lega/nuova", { replace: true }); }, [setLocation]);
  return null;
}
