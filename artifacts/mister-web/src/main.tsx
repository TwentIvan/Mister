import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";

// T177b: base URL API — tripla via, in ordine di priorità:
// 1. VITE_API_URL se cotta nel bundle; 2. DERIVAZIONE dal dominio
// (app.X → https://api.X): zero configurazione, immune a env/cache;
// 3. null → percorsi relativi (dev col proxy Vite).
const envUrl = (import.meta.env.VITE_API_URL as string | undefined) || null;
const host = window.location.hostname;
const derivedUrl = host.startsWith("app.")
  ? `${window.location.protocol}//api.${host.slice(4)}`
  : null;
setBaseUrl(envUrl ?? derivedUrl);
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
