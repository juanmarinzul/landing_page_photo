<div align="center">

# 🛡️ Veridia

### Demo académica de verificación de identidad biométrica

Reconocimiento facial con prueba de vida · Escaneo de documento por ambos lados · Comparación rostro–documento

**Todo el procesamiento ocurre en el navegador. Sin backend. Sin envío de datos.**

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## 📑 Tabla de contenido

- [Sobre el proyecto](#-sobre-el-proyecto)
- [Alcance y privacidad](#-alcance-y-privacidad)
- [Para qué sirve (y para qué no)](#-para-qué-sirve-y-para-qué-no)
- [Módulos](#-módulos)
- [Capturas del flujo](#-capturas-del-flujo)
- [Requisitos](#-requisitos)
- [Instalación y ejecución](#-instalación-y-ejecución)
- [Probar desde el móvil](#-probar-desde-el-móvil)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Tecnología](#-tecnología)
- [Cómo funciona](#-cómo-funciona)
- [Documentación adicional](#-documentación-adicional)
- [Limitaciones conocidas](#-limitaciones-conocidas)
- [Licencia](#-licencia)

---

## 🎯 Sobre el proyecto

**Veridia** es un **proyecto académico** que demuestra la **experiencia de usuario
(UI/UX)** de un flujo de verificación de identidad como el de las aplicaciones
bancarias. Fue construido con **Next.js 16** (App Router), React 19, TypeScript y
Tailwind CSS 4.

El objetivo es ilustrar, con código abierto y revisable, cómo se diseña un
onboarding biométrico: la guía visual de la cámara, la prueba de vida con acciones
aleatorias, el control de calidad de la captura del documento y la comparación
entre el rostro en vivo y la foto del documento.

---

## 🔒 Alcance y privacidad

> [!IMPORTANT]
> Este repositorio contiene **únicamente la interfaz y la lógica de análisis que
> corre en el navegador**. **No tiene backend, no expone ninguna API, no se conecta
> a ningún servicio y no transmite ni almacena información.**

Todo el trabajo (cámara, detección facial, OCR y comparación) se ejecuta en el
dispositivo del usuario con **TensorFlow.js** sobre WebGL. Las imágenes viven solo
en memoria mientras la página está abierta y **desaparecen al recargar o cerrar**.
No existe base de datos, ni cookies de seguimiento, ni llamadas de red con datos
personales. Lo único que se descarga son archivos estáticos: los modelos de IA
(desde el propio sitio) y, la primera vez, el motor de OCR y el idioma español
(desde un CDN público).

---

## ✅ Para qué sirve (y para qué no)

| | |
|---|---|
| ✅ | Demostrar y estudiar el diseño de un onboarding biométrico. |
| ✅ | Material de clase para revisar el código y las técnicas de visión por computador. |
| ✅ | Ejecutarse de forma local y autocontenida, sin infraestructura. |
| ❌ | **No** es un producto de producción ni una solución certificada de anti-suplantación (PAD / ISO&nbsp;30107). |
| ❌ | **No** debe desplegarse para capturar el rostro o los documentos de personas reales **sin su consentimiento informado** y una base legal para tratar datos biométricos. |

> Los datos biométricos (rostro) y los documentos de identidad son **datos
> personales sensibles** en la mayoría de las jurisdicciones (p. ej. la Ley 1581 de
> 2012 en Colombia o el RGPD en Europa). Trátalos en consecuencia.
> Consulta el [AVISO DE USO RESPONSABLE](./AVISO.md).

---

## 🧩 Módulos

| Ruta | Módulo | Descripción |
| --- | --- | --- |
| `/` | Landing | Página de presentación del proyecto y sus módulos. |
| `/rostro` | Reconocimiento facial | Prueba de vida con óvalo guía y acciones aleatorias: parpadear, girar la cabeza y sonreír. |
| `/documento` | Escaneo de documento | Captura de la cédula **por ambos lados** con control de enfoque, luz y reflejos, detección de la foto del titular y lectura de datos (OCR). |
| `/verificacion` | Flujo completo | Documento → prueba de vida → comparación biométrica 1:1 y veredicto con reporte descargable. |

---

## 📷 Capturas del flujo

> _(Opcional: agrega aquí capturas de pantalla de cada módulo para la entrega.
> Puedes guardarlas en una carpeta `docs/img/` y enlazarlas.)_

---

## 🛠 Requisitos

- **Node.js 20+** (probado con Node 24).
- Un navegador moderno con soporte de **WebGL** y **getUserMedia** (Chrome, Edge,
  Safari o Firefox recientes).
- Una cámara (web o de celular).

---

## 🚀 Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Entorno de desarrollo
npm run dev
# → http://localhost:3000

# 3. Build de producción y arranque
npm run build
npm run start
```

Scripts disponibles (`package.json`):

| Script | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run build` | Compilación optimizada de producción. |
| `npm run start` | Sirve la build de producción. |
| `npm run lint` | Linter (ESLint). |

> La cámara solo funciona en un **contexto seguro**: `localhost` o **HTTPS**.

---

## 📱 Probar desde el móvil

El navegador del celular exige HTTPS para habilitar la cámara. La forma más simple
es exponer el servidor local con un túnel HTTPS temporal:

```bash
# Con la app corriendo (npm run dev o npm run start)
npx cloudflared tunnel --url http://localhost:3000
# o:  ngrok http 3000
```

Abre en el celular la URL `https://…` que imprime el túnel. Ciérralo (Ctrl+C)
cuando termines.

---

## 📂 Estructura del proyecto

```
landing_page_photo/
├─ public/
│  └─ models/                     # Modelos de IA (TensorFlow.js) servidos localmente
├─ src/
│  ├─ app/                        # Rutas (App Router)
│  │  ├─ page.tsx                 # Landing
│  │  ├─ rostro/page.tsx          # Módulo de reconocimiento facial
│  │  ├─ documento/page.tsx       # Módulo de escaneo de documento
│  │  ├─ verificacion/page.tsx    # Flujo completo
│  │  ├─ layout.tsx               # Layout raíz y metadatos
│  │  └─ globals.css              # Estilos globales y utilidades
│  ├─ components/
│  │  ├─ site/                    # Encabezado, pie y contenedor de módulos
│  │  ├─ flows/Flows.tsx          # Orquestación de los flujos y estados
│  │  └─ verify/                  # Componentes de cámara y verificación
│  │     ├─ FaceLiveness.tsx      # Prueba de vida facial
│  │     ├─ DocumentScanner.tsx   # Escáner del documento (ambos lados)
│  │     ├─ MatchResult.tsx       # Resultado de la comparación 1:1
│  │     └─ PreparingStatus.tsx   # Progreso de carga de cámara + IA
│  ├─ hooks/
│  │  └─ useCamera.ts             # Acceso a la cámara (getUserMedia)
│  └─ lib/
│     ├─ face.ts                  # Carga de modelos, detección y comparación facial
│     └─ ocr.ts                   # OCR y extracción de datos del documento
├─ README.md
├─ AVISO.md                       # Aviso de uso responsable
├─ docs/ARQUITECTURA.md           # Documentación técnica detallada
└─ LICENSE                        # Licencia MIT
```

---

## 🧠 Tecnología

| Componente | Uso |
| --- | --- |
| **Next.js 16** + React 19 + TypeScript | Framework y UI. |
| **Tailwind CSS 4** | Estilos y diseño responsivo. |
| **[`@vladmandic/face-api`](https://github.com/vladmandic/face-api)** (MIT) | Detección facial, 68 puntos faciales, expresiones y descriptor de 128 dimensiones, sobre **TensorFlow.js** + WebGL. |
| **[`tesseract.js`](https://github.com/naptha/tesseract.js)** (Apache-2.0) | OCR en español para leer los datos del documento. |
| **[`motion`](https://motion.dev)** | Animaciones. |
| **[`lucide-react`](https://lucide.dev)** | Iconografía. |

Los modelos de IA son de código abierto y de uso general; su precisión **no es
equiparable** a la de los servicios comerciales de verificación de identidad.

---

## ⚙️ Cómo funciona

1. **Reconocimiento facial.** El detector ubica el rostro y sus 68 puntos. La
   prueba de vida pide acciones aleatorias (parpadeo, giro, sonrisa) que se validan
   midiendo la apertura de los ojos, el giro de la cabeza y la expresión. Al final
   se genera un **descriptor facial** (vector de 128 números).
2. **Documento.** Un marco guía evalúa en tiempo real enfoque, iluminación y
   reflejos, y captura automáticamente cada lado. En el frente detecta la foto del
   titular y genera su descriptor; el OCR lee número, nombres, fecha de nacimiento,
   sexo y RH (incluida la zona MRZ de la cédula digital).
3. **Comparación 1:1.** Se calcula la **distancia euclidiana** entre el descriptor
   del rostro en vivo y el de la foto del documento. Si es `< 0.55`, se considera la
   misma persona. El umbral está en `src/lib/face.ts`.

Para el detalle técnico, consulta [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md).

---

## 📚 Documentación adicional

- [`AVISO.md`](./AVISO.md) — Aviso de uso responsable, privacidad y datos personales.
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — Arquitectura, flujo de datos y decisiones técnicas.
- [`LICENSE`](./LICENSE) — Licencia MIT.

---

## ⚠️ Limitaciones conocidas

- La prueba de vida con acciones aleatorias dificulta el uso de fotos o videos,
  pero **no es un sistema certificado de anti-suplantación**.
- La comparación con fotos de documentos (pequeñas, con hologramas y en escala de
  grises) es menos precisa que la de un proveedor comercial.
- El OCR depende de la calidad de la cámara y la iluminación; algunos campos pueden
  quedar sin detectar.
- Requiere WebGL; en equipos muy antiguos la carga de los modelos puede ser lenta.

---

## 📄 Licencia

Distribuido bajo licencia **MIT** (ver [`LICENSE`](./LICENSE)). El software se
entrega "tal cual", sin garantías de ningún tipo, y los autores no asumen
responsabilidad por el uso que terceros hagan del código.

<div align="center">

_Proyecto académico · Desarrollado con fines educativos_

</div>
