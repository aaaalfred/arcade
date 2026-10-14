import { render } from "preact";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "./App";
import { boot, createServices, ServicesContext } from "./services";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";

const services = createServices();

declare global {
  interface Window {
    /** Solo para depuración y pruebas E2E. */
    __arcade?: typeof services;
  }
}
if (import.meta.env.DEV || import.meta.env.VITE_INCLUDE_DEV_GAMES === "1") window.__arcade = services;

render(
  <ServicesContext.Provider value={services}>
    <App />
  </ServicesContext.Provider>,
  document.getElementById("app")!,
);

void boot(services).finally(() => void SplashScreen.hide().catch(() => undefined));
