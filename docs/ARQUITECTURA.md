# 🏗️ Arquitectura técnica

Documento de apoyo para la revisión del código. Describe cómo está organizado el
proyecto, cómo fluye la información y las decisiones técnicas más relevantes.

> **Recordatorio:** todo ocurre en el navegador. No hay servidor de aplicación, API
> ni base de datos. Next.js se usa únicamente para construir y servir las páginas
> estáticas; no hay rutas de servidor que reciban datos.

---

## 1. Visión general

```
┌─────────────────────────────────────────────────────────────┐
│                      Navegador del usuario                   │
│                                                              │
│   Cámara (getUserMedia)                                      │
│        │                                                     │
│        ▼                                                     │
│   Componentes React  ──►  src/lib/face.ts  (TensorFlow.js)   │
│   (FaceLiveness,          src/lib/ocr.ts   (tesseract.js)    │
│    DocumentScanner)                                          │
│        │                          │                          │
│        ▼                          ▼                          │
│   Descriptores faciales     Datos del documento (OCR)        │
│        │                          │                          │
│        └──────────┬───────────────┘                          │
│                   ▼                                           │
│          Comparación 1:1 (distancia euclidiana)              │
│                   │                                           │
│                   ▼                                           │
│          Resultado en pantalla  ·  Reporte JSON (descarga)   │
└─────────────────────────────────────────────────────────────┘

        Sin red con datos personales. Nada sale del dispositivo.
```

Las únicas descargas por red son **archivos estáticos**: los modelos de IA
(`/public/models`, servidos desde el propio sitio) y, la primera vez, el motor y el
idioma del OCR desde un CDN público.

---

## 2. Rutas (App Router)

| Archivo | Ruta | Rol |
| --- | --- | --- |
| `src/app/page.tsx` | `/` | Landing. |
| `src/app/rostro/page.tsx` | `/rostro` | Monta el flujo de reconocimiento facial. |
| `src/app/documento/page.tsx` | `/documento` | Monta el flujo de escaneo de documento. |
| `src/app/verificacion/page.tsx` | `/verificacion` | Monta el flujo completo. |
| `src/app/layout.tsx` | — | Layout raíz, fuentes y metadatos. |

Las páginas son _Server Components_ ligeros que renderizan _Client Components_
(los que usan cámara e IA, marcados con `"use client"`).

---

## 3. Capa de dominio (`src/lib`)

### `face.ts` — Visión facial y comparación

- **Carga de modelos (`loadFaceApi`)**: inicializa TensorFlow.js (backend WebGL con
  respaldo a CPU) y carga una sola vez los cinco modelos. Es un _singleton_
  compartido por toda la app.
- **Precalentamiento (`warmFaceApi`, `preloadFaceApi`, `prepareFaceApi`)**: la
  primera inferencia de cada red compila sus _shaders_ de WebGL y bloquea la
  interfaz un instante. Se ejecuta de forma anticipada y escalonada (cediendo el
  hilo entre pasos) para que la cámara responda cuanto antes. Incluye _timeouts_
  para que la pantalla de carga nunca se quede esperando indefinidamente.
- **Detección robusta (`describeFace`)**: prueba varios detectores en cascada
  (TinyFaceDetector en distintos tamaños y SSD MobilenetV1) y descarta descriptores
  inválidos. Esto evita fallos en GPUs móviles que trabajan con menor precisión.
- **Métricas de prueba de vida**: `eyeAspectRatio` (apertura geométrica del ojo),
  `eyeContrast` (apertura por contraste de píxeles) y `estimateYaw` (giro
  horizontal de la cabeza).
- **Calidad de imagen (`analyzeQuality`)**: nitidez (varianza del Laplaciano),
  brillo, reflejos y densidad de bordes.
- **Comparación (`euclidean`, `similarityFromDistance`, `MATCH_THRESHOLD`)**:
  distancia euclidiana entre descriptores; coincide si es `< 0.55`.

### `ocr.ts` — Lectura del documento

- **Motor (`createOcrEngine`)**: crea un _worker_ de Tesseract que se descarga en
  segundo plano mientras el usuario ubica la cédula, para no bloquear la interfaz.
- **Preprocesado**: escala de grises y aumento de contraste antes del OCR.
- **Análisis (`parseDocumentText`)**: combina el texto de ambas caras y extrae
  número, apellidos, nombres, fecha de nacimiento, sexo y RH. Incluye un lector de
  la zona **MRZ** del reverso de la cédula digital.

---

## 4. Componentes de verificación (`src/components/verify`)

| Componente | Responsabilidad |
| --- | --- |
| `FaceLiveness.tsx` | Prueba de vida: óvalo guía, malla de puntos, retos aleatorios, captura del descriptor y manejo de reintentos/timeouts. |
| `DocumentScanner.tsx` | Captura de la cédula por ambos lados, control de calidad en vivo, detección de la foto del titular y disparo del OCR. |
| `MatchResult.tsx` | Comparación 1:1, indicador de similitud, detalles y reporte JSON descargable. |
| `PreparingStatus.tsx` | Progreso combinado de cámara + descarga de modelos + optimización. |

`src/components/flows/Flows.tsx` orquesta los tres flujos (`FaceFlow`,
`DocumentFlow`, `VerificationFlow`) y los estados intermedios.

---

## 5. Acceso a la cámara (`src/hooks/useCamera.ts`)

Encapsula `navigator.mediaDevices.getUserMedia`:

- Selecciona cámara frontal (`user`) o trasera (`environment`) y resolución.
- Traduce los errores a mensajes claros (permiso denegado, cámara en uso, contexto
  no seguro, etc.).
- Aplica _timeouts_ al arranque del video para no quedarse esperando el primer
  cuadro en móviles que no emiten el evento esperado.
- Libera la cámara (`stop`) al desmontar o terminar.

---

## 6. Flujo de datos y ciclo de vida

1. El usuario concede permiso de cámara.
2. Los cuadros de video se analizan **en memoria**; se reduce su resolución antes de
   procesarlos para mantener la interfaz fluida.
3. Se generan descriptores (vectores numéricos) y, en el documento, texto por OCR.
4. La comparación produce un veredicto que se muestra en pantalla.
5. Al **recargar o cerrar** la página, todo (imágenes, descriptores, texto) se
   descarta: no persiste en disco, ni en almacenamiento del navegador, ni en red.

El **reporte JSON** descargable es opcional y lo genera y guarda el propio usuario
en su equipo; no se envía a ningún lado.

---

## 7. Modelos de IA incluidos (`public/models`)

| Modelo | Uso |
| --- | --- |
| `tiny_face_detector` | Detección rápida de rostro en vivo y en el documento. |
| `ssd_mobilenetv1` | Detección más precisa para la captura final. |
| `face_landmark_68` | 68 puntos faciales (ojos, giro de cabeza). |
| `face_expression` | Detección de la sonrisa. |
| `face_recognition` | Descriptor facial de 128 dimensiones. |

Provienen del paquete `@vladmandic/face-api` (MIT) y se sirven localmente para no
depender de servicios externos.

---

## 8. Decisiones de diseño destacadas

- **Todo en el cliente** para proteger la privacidad y evitar infraestructura.
- **Detección en cascada** para funcionar en una variedad amplia de dispositivos.
- **Precalentamiento y timeouts** para que la interfaz nunca se bloquee ni se quede
  "pegada" esperando.
- **Reducción de resolución** en el análisis en vivo para rendimiento fluido en
  móviles.
- **Umbral de comparación configurable** (`MATCH_THRESHOLD`) para poder ajustar la
  sensibilidad del veredicto.
