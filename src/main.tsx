import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SHARED_PROBE } from "./lib/cody-shared-probe";

if (import.meta.env.DEV) console.log("[cody-shared]", SHARED_PROBE);

createRoot(document.getElementById("root")!).render(<App />);
