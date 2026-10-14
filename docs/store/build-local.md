# Compilar la app (Android e iOS)

> Estado verificado en este repo: **Android debug (`.apk`) y release firmado (`.aab`) compilan** en Linux con el SDK instalado.
> **iOS no se ha compilado**: requiere macOS + Xcode 26 (ver abajo).

## Requisitos

| Herramienta | Versión | Nota |
|---|---|---|
| Node | ≥ 22 | `corepack enable` y pnpm 10 (`packageManager` en `package.json`) |
| JDK | 21 | Capacitor 8 compila con Java 21 |
| Android SDK | plataforma 36, build-tools 36.0.0 | `ANDROID_HOME=~/Android/Sdk` |
| Xcode (solo iOS) | 26+ | Capacitor 8 exige iOS ≥ 15 y SPM; App Store Connect rechaza subidas con Xcode anterior a la 26 |

## Variables de entorno

Se leen al **construir** (se incrustan en la app). Ninguna es secreta salvo las de firma.

| Variable | Uso | Por defecto |
|---|---|---|
| `APP_ID` | Id del paquete (`com.tuempresa.arcade`). **Solo se aplica en `cap add`** (ver «Cambiar el appId») | `com.example.arcade` |
| `APP_NAME` | Nombre visible | `Arcade` |
| `VITE_API_URL` | URL HTTPS de la API. Vacía ⇒ la app funciona 100 % sin conexión (sin ranking ni sincronización) | vacía (en dev: `http://localhost:8787`) |
| `VITE_PRIVACY_URL` | Enlace a la política de privacidad (Perfil) | vacía (no se muestra) |
| `VITE_ADS_ENABLED` | `0` apaga los anuncios | activos |
| `VITE_ADMOB_INTERSTITIAL_ANDROID`, `VITE_ADMOB_REWARDED_ANDROID`, `…_IOS` | Unidades de anuncio reales | IDs de **prueba** de Google |
| `ADMOB_APP_ID_ANDROID`, `ADMOB_APP_ID_IOS` | ID de app de AdMob (manifiesto / Info.plist) | IDs de **prueba** de Google |
| `VERSION_CODE`, `VERSION_NAME` | Versión Android (`versionCode` debe subir en cada subida a Play) | `1`, `1.0` |
| `ARCADE_KEYSTORE_FILE`, `ARCADE_KEYSTORE_PASSWORD`, `ARCADE_KEY_ALIAS`, `ARCADE_KEY_PASSWORD` | Firma de release | sin firma |

> Con IDs de prueba la app muestra anuncios de prueba. **Nunca pulses anuncios reales con tu propia cuenta de AdMob**: es motivo de suspensión.

## Android

```bash
pnpm install
cd apps/shell
export ANDROID_HOME=$HOME/Android/Sdk
echo "sdk.dir=$ANDROID_HOME" > android/local.properties     # una vez

pnpm android:debug        # → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Para probar contra una API local desde el emulador usa `VITE_API_URL=http://10.0.2.2:8787` (el build **debug** permite HTTP solo a `10.0.2.2` y `localhost`; el release no permite HTTP).

### Firmar y generar el `.aab` de Play Store
```bash
# 1) Crear la keystore UNA vez y guardarla fuera del repo, con copia segura (si se pierde no podrás actualizar la app)
keytool -genkeypair -v -keystore ~/arcade-release.keystore -alias arcade -keyalg RSA -keysize 2048 -validity 10000

# 2) Compilar
export ARCADE_KEYSTORE_FILE=$HOME/arcade-release.keystore
export ARCADE_KEYSTORE_PASSWORD=…  ARCADE_KEY_ALIAS=arcade  ARCADE_KEY_PASSWORD=…
export VERSION_CODE=1 VERSION_NAME=1.0.0
VITE_API_URL=https://api.tudominio.com pnpm android:release
# → android/app/build/outputs/bundle/release/app-release.aab
```
Activa **Play App Signing** en la consola: Google guarda la llave de firma final y la tuya queda como llave de subida.

## iOS (en un Mac)

```bash
pnpm install
cd apps/shell
pnpm native:sync                       # compila la web, `cap sync` y aplica los parches nativos
open ios/App/App.xcodeproj             # Xcode 26: elige tu Team, ajusta el Bundle Identifier y archiva (Product → Archive)
```
Las dependencias nativas se resuelven con Swift Package Manager; el primer abrir tarda mientras descarga `capacitor-swift-pm`.
El flujo automatizado (sin verificar) está en `.github/workflows/ios-testflight.yml`.

## Cambiar el appId (hazlo ANTES de la primera subida)

`appId` queda escrito en Gradle y en el proyecto Xcode al ejecutar `cap add`. Para cambiarlo mientras no hayas personalizado los proyectos nativos a mano:
```bash
cd apps/shell
rm -rf android ios
APP_ID=com.tuempresa.arcade APP_NAME="Tu nombre" pnpm exec cap add android
APP_ID=com.tuempresa.arcade APP_NAME="Tu nombre" pnpm exec cap add ios
pnpm native:assets      # íconos y splash
pnpm native:sync        # parches: AdMob, ATT, red de depuración, firma y versionado
```
Todas las personalizaciones nativas viven en `scripts/patch-native.mjs`, que es idempotente: no edites los proyectos nativos a mano sin reflejarlo ahí.

## Íconos y splash
Los de ahora son **provisionales** (`resources/icon.svg`, `resources/splash.svg`). Sustitúyelos por los definitivos (SVG o PNG 1024×1024 / 2732×2732) y ejecuta `pnpm native:assets`.

## Qué se ha verificado y qué no

| | Estado |
|---|---|
| APK debug compila (targetSdk 36, minSdk 24) y contiene los juegos y el SDK | ✔ verificado |
| AAB release firmado con keystore (`jarsigner -verify`) y sin firmar sin ella | ✔ verificado |
| App ejecutándose en un dispositivo/emulador Android | ✘ **no probado** (sin dispositivo en el entorno) |
| Anuncios AdMob reales o de prueba en dispositivo; consentimiento UMP; ATT | ✘ **no probado** |
| Proyecto iOS compila y corre | ✘ **no probado** (sin macOS) |
| Botón atrás de Android, orientación por juego, háptica nativa | ✘ **no probado** en dispositivo |
