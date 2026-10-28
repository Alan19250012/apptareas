# 🌱 Hábitat — Rastreador de Hábitos

Un **rastreador de hábitos visual** con **calendario mensual, agenda, rachas, estadísticas y panel de progreso**. Disponible como **app web (PWA)**, como **APK para Android** y con una **plantilla para Excel / Google Sheets**.

- 🎨 **Modo oscuro** por defecto (y modo claro).
- 📅 **Calendario mensual** interactivo: toca un día para ver y marcar tus hábitos.
- 🗓️ **Agenda** con eventos (fecha, hora, nota y color).
- 🔥 **Rachas** actuales y récords por hábito.
- 📈 **Estadísticas**: consistencia, mapa de actividad (heatmap), tendencia de 7 días.
- 🎯 **Panel de progreso** con indicadores clave y checklist de hoy.
- ⭐ **Gamificación**: ganas XP por cada hábito y subes de nivel.
- 📱 **App nativa Android (APK)** y **PWA instalable**, funciona **sin conexión**.
- 💾 **Exporta/importa** tu progreso (JSON) y exporta registros a **CSV**.

---

## 📲 APK para Android (instalable)

El archivo **`Habitat.apk`** es una app Android nativa (hecha con **Capacitor**, que envuelve esta misma interfaz) lista para instalar:

1. Copia `Habitat.apk` a tu teléfono (por USB, Drive, correo…).
2. Ábrelo y acepta la instalación (permite "orígenes desconocidos" si te lo pide).
3. La app aparece como **Hábitat** con su icono.

Requisitos: **Android 7.0 (API 24) o superior**.

> Es una build de **debug** (firmada con clave de desarrollo): perfecta para uso personal. Para publicarla en Play Store haría falta una firma de release (ver más abajo).

### Recompilar el APK
```bash
npm install                 # instala Capacitor + exceljs (primera vez)
npm run cap:sync            # copia la web a android/ (tras cambios en app/)
npm run apk                 # genera android/app/build/outputs/apk/debug/app-debug.apk
```
Requisitos de compilación: **JDK 21** y **Android SDK** (platform 36 + build-tools 36). Si no tienes el SDK, ejecuta:
```bash
powershell -ExecutionPolicy Bypass -File tools/setup_android_sdk.ps1
```

### Firma de release (opcional, para Play Store)
```bash
# 1) Crea un keystore (una sola vez)
keytool -genkeypair -v -keystore habitat.keystore -alias habitat -keyalg RSA -keysize 2048 -validity 10000
# 2) Añade a android/gradle.properties:
#    RELEASE_STORE_FILE=habitat.keystore
#    RELEASE_STORE_PASSWORD=...
#    RELEASE_KEY_ALIAS=habitat
#    RELEASE_KEY_PASSWORD=...
# 3) Genera
npm run apk:release
```

---

## 🌐 App web (PWA)

```bash
npm run serve
# o: python -m http.server 8123 --directory app
```
Abre **http://127.0.0.1:8123/**. En el móvil, usa **«Añadir a pantalla de inicio»** para instalarla como app sin conexión.

---

## 📊 Plantilla para Excel / Google Sheets

El archivo **`sheets/RastreadorHabitos.xlsx`** incluye 6 hojas:

| Hoja | Qué hace |
|------|----------|
| 📖 Instrucciones | Guía rápida de uso |
| ✅ Registro | Rejilla diaria del año: marca con una `x` cada hábito cumplido |
| 📊 Estadísticas | Total, mes, semana, % de cumplimiento, **racha actual** y **mejor racha** |
| 🎯 Panel | Resumen visual con los indicadores clave |
| 📅 Agenda | **Calendario mensual automático** (verde = días con actividad) + tabla de eventos |
| ⚙️ Aux (oculta) | Cálculo interno de rachas |

**Google Sheets:** [sheets.new](https://sheets.new) → *Archivo → Importar → Subir* → selecciona el `.xlsx`.
**Excel:** ábrelo directamente. La fila de hoy se resalta y los hábitos se pintan de verde.

Regenerar: `npm run sheet`.

---

## 📁 Contenido

```
├── app/                        → App web (PWA)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js                   → service worker (offline)
│   ├── css/styles.css
│   ├── js/app.js
│   └── icons/
├── android/                    → Proyecto Android (Capacitor) → genera el APK
├── sheets/
│   ├── RastreadorHabitos.xlsx  → plantilla Excel / Google Sheets
│   └── generate_sheet.mjs
├── tools/
│   ├── generate_icons.py       → iconos web
│   ├── generate_android_icons.py → iconos/splash de Android
│   ├── setup_android_sdk.ps1   → instala el Android SDK
│   └── smoke_test.mjs          → prueba de humo de la app
├── capacitor.config.json
└── package.json
```

---

## 🌍 Publicar la PWA en GitHub Pages

1. `git init && git add . && git commit -m "Hábitat" && git push`
2. En GitHub: **Settings → Pages → Source → Deploy from a branch** → rama `main`, carpeta **`/app`**.
3. Disponible en `https://TU_USUARIO.github.io/habitat-habit-tracker/`.

---

## 🔒 Privacidad

Todos los datos se guardan **localmente** (en el navegador o en el almacenamiento de la app). Nada se envía a servidores. Usa **Ajustes → Respaldar (JSON)** para copias de seguridad.

## 🛠️ Tecnología

HTML + CSS + JavaScript puro, **Capacitor** para el APK, `exceljs` para el `.xlsx` y Python (stdlib) para los iconos.

## 📄 Licencia

MIT — úsalo, modifícalo y compártelo libremente.
