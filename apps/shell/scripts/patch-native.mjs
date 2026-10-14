// Parches idempotentes a los proyectos nativos generados por Capacitor (AdMob, ATT, red, backup).
// Se ejecuta tras `cap add` y `cap sync` (ver "native:sync"). Repetirlo no duplica nada.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// IDs de PRUEBA de Google. Reemplázalos con ADMOB_APP_ID_ANDROID / ADMOB_APP_ID_IOS al publicar.
const ANDROID_APP_ID = process.env.ADMOB_APP_ID_ANDROID ?? "ca-app-pub-3940256099942544~3347511713";
const IOS_APP_ID = process.env.ADMOB_APP_ID_IOS ?? "ca-app-pub-3940256099942544~1458002511";
const ATT_TEXT =
  process.env.ATT_TEXT ?? "Usamos este identificador para mostrarte anuncios más relevantes. Puedes jugar igual si prefieres no permitirlo.";

const changes = [];
const read = (p) => readFileSync(p, "utf8");
function write(p, content, note) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  changes.push(note);
}

/* ---------- Android ---------- */
const manifest = join(root, "android/app/src/main/AndroidManifest.xml");
if (existsSync(manifest)) {
  let xml = read(manifest);
  if (xml.includes("com.google.android.gms.ads.APPLICATION_ID")) {
    xml = xml.replace(/(com\.google\.android\.gms\.ads\.APPLICATION_ID"\s+android:value=")[^"]*(")/, `$1${ANDROID_APP_ID}$2`);
  } else {
    xml = xml.replace(
      /(<application\b[^>]*>)/,
      `$1\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${ANDROID_APP_ID}" />`,
    );
  }
  if (!xml.includes("android:allowBackup=")) xml = xml.replace("<application", '<application android:allowBackup="true"');
  if (xml !== read(manifest)) write(manifest, xml, "AndroidManifest: ID de AdMob");

  // Solo en builds debug: permitir HTTP al emulador (10.0.2.2) para probar contra una API local.
  const debugDir = join(root, "android/app/src/debug");
  const debugManifest = join(debugDir, "AndroidManifest.xml");
  if (!existsSync(debugManifest)) {
    write(
      debugManifest,
      `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">\n    <application android:networkSecurityConfig="@xml/network_security_config" tools:replace="android:networkSecurityConfig" />\n</manifest>\n`,
      "Android debug: network_security_config",
    );
    write(
      join(debugDir, "res/xml/network_security_config.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n    <domain-config cleartextTrafficPermitted="true">\n        <domain includeSubdomains="false">10.0.2.2</domain>\n        <domain includeSubdomains="false">localhost</domain>\n    </domain-config>\n</network-security-config>\n`,
      "Android debug: dominios HTTP de desarrollo",
    );
  }
}

// Firma de release y versionado por variables de entorno (la keystore nunca va en el repo).
const gradle = join(root, "android/app/build.gradle");
if (existsSync(gradle)) {
  let g = read(gradle);
  if (!g.includes("ARCADE_KEYSTORE_FILE")) {
    g = g.replace(
      /versionCode\s+\d+\s*\n\s*versionName\s+"[^"]*"/,
      'versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")\n        versionName System.getenv("VERSION_NAME") ?: "1.0"',
    );
    g = g.replace(
      /(\n\s*buildTypes\s*\{)/,
      `
    signingConfigs {
        release {
            def ks = System.getenv("ARCADE_KEYSTORE_FILE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("ARCADE_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ARCADE_KEY_ALIAS")
                keyPassword System.getenv("ARCADE_KEY_PASSWORD")
            }
        }
    }$1`,
    );
    g = g.replace(
      /(release\s*\{\s*\n)(\s*)(minifyEnabled)/,
      '$1$2if (System.getenv("ARCADE_KEYSTORE_FILE")) { signingConfig signingConfigs.release }\n$2$3',
    );
    write(gradle, g, "build.gradle: firma de release y versionado por entorno");
  }
}

/* ---------- iOS ---------- */
const plist = join(root, "ios/App/App/Info.plist");
if (existsSync(plist)) {
  let xml = read(plist);
  const add = (key, valueXml) => {
    if (xml.includes(`<key>${key}</key>`)) return false;
    xml = xml.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${valueXml}\n</dict>\n</plist>\n`);
    return true;
  };
  const added = [
    add("GADApplicationIdentifier", `<string>${IOS_APP_ID}</string>`),
    add("NSUserTrackingUsageDescription", `<string>${ATT_TEXT}</string>`),
    add("ITSAppUsesNonExemptEncryption", "<false/>"),
    // Google es la red mínima; añade la lista completa de https://developers.google.com/admob/ios/3p-skadnetworks al activar mediación.
    add("SKAdNetworkItems", "<array>\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n\t</array>"),
  ];
  if (added.some(Boolean)) write(plist, xml, "Info.plist: AdMob, ATT y cifrado");
  else if (xml.includes("GADApplicationIdentifier") && !xml.includes(IOS_APP_ID)) {
    xml = xml.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${IOS_APP_ID}$2`);
    write(plist, xml, "Info.plist: ID de AdMob");
  }
}

console.log(changes.length ? `Parches aplicados:\n - ${changes.join("\n - ")}` : "Los proyectos nativos ya estaban parcheados.");
