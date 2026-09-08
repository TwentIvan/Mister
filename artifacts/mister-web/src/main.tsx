import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";

// T177: API su dominio separato in produzione (api.fantamister.cloud).
// In dev resta il proxy Vite (variabile assente → percorsi relativi).
setBaseUrl(import.meta.env.VITE_API_URL ?? null);
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
