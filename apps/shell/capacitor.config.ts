import type { CapacitorConfig } from "@capacitor/cli";

/**
 * APP_ID y APP_NAME se leen al ejecutar `cap add`/`cap sync`.
 * El appId definitivo debe fijarse ANTES de la primera subida a una tienda: no se puede cambiar después.
 */
const config: CapacitorConfig = {
  appId: process.env.APP_ID ?? "com.example.arcade",
  appName: process.env.APP_NAME ?? "Arcade",
  webDir: "dist",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchShowDuration: 600, launchAutoHide: true, backgroundColor: "#e9ecf1", showSpinner: false },
    Keyboard: { resize: "none" },
  },
};

export default config;
