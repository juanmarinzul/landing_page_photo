export type DocumentFields = {
  number: string | null;
  surnames: string | null;
  names: string | null;
  birthDate: string | null;
  sex: string | null;
  bloodType: string | null;
  raw: string;
};

const LABEL = /APELLIDO|NOMBRE|NUMERO|NÚMERO|REPUBLICA|REPÚBLICA|IDENTIFICACI|CEDULA|CÉDULA|CIUDADAN|FIRMA|DOCUMENTO|NACIONAL|PERSONAL|COLOMBIA|FECHA|SEXO|NACIMIENTO|EXPEDICI|ESTATURA|LUGAR|INDICE|DERECHO/i;
const MONTHS = "ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC";
const DATE = new RegExp(`\\b\\d{1,2}[\\s\\-/.](?:\\d{1,2}|(?:${MONTHS})[A-Z]*)[\\s\\-/.](\\d{4}|\\d{2})\\b`, "gi");

/** Extrae la secuencia de palabras en mayúscula de una línea, ignorando ruido del OCR ("ANA MARIA —-"). */
function nameIn(line: string | undefined): string | null {
  if (!line || LABEL.test(line) || /\d{3,}/.test(line)) return null;
  const words = line.match(/[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*/);
  return words && words[0].length >= 3 ? words[0].replace(/\s+/g, " ") : null;
}

function valueNear(lines: string[], label: RegExp): string | null {
  const i = lines.findIndex((l) => label.test(l));
  if (i === -1) return null;
  // Cédula colombiana: el valor va encima de la etiqueta. Otros documentos: debajo.
  return nameIn(lines[i - 1]) ?? nameIn(lines[i + 1]);
}

function yearOf(date: string): number {
  const y = Number(date.match(/(\d{2,4})$/)?.[1] ?? 0);
  return y < 100 ? (y > 40 ? 1900 + y : 2000 + y) : y;
}

/** Zona de lectura mecánica (MRZ) del reverso de la cédula digital / pasaportes. */
function parseMrz(lines: string[]) {
  const mrz = lines
    .map((l) => l.replace(/\s/g, "").replace(/[«‹]/g, "<").toUpperCase())
    .filter((l) => l.length >= 20 && l.includes("<") && /^[A-Z0-9<]+$/.test(l));
  if (!mrz.some((l) => l.includes("<<"))) return null;
  let birthDate: string | null = null;
  let sex: string | null = null;
  let surnames: string | null = null;
  let names: string | null = null;
  for (const l of mrz) {
    const data = l.match(/(\d{2})(\d{2})(\d{2})\d([MF])\d{6}/);
    if (data && !birthDate) {
      const [, yy, mm, dd, s] = data;
      birthDate = `${dd}/${mm}/${Number(yy) > 40 ? "19" : "20"}${yy}`;
      sex = s;
    }
    const nameParts = l.match(/^([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)/);
    if (nameParts && !/\d/.test(l) && !surnames) {
      surnames = nameParts[1].replace(/</g, " ");
      names = nameParts[2].replace(/</g, " ");
    }
  }
  return { birthDate, sex, surnames, names };
}

/** Une y analiza el texto de ambas caras del documento. */
export function parseDocumentText(front: string, back = ""): DocumentFields {
  const toLines = (t: string) =>
    t
      .replace(/[|_~]/g, " ")
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 1);
  const frontLines = toLines(front);
  const backLines = toLines(back);
  const all = [...frontLines, ...backLines];
  const text = all.join("\n");
  const frontText = frontLines.join("\n");

  const numberMatch =
    frontText.match(/(?:N[UÚ]MERO|NUIP|DNI|N[°º.]|DOC(?:UMENTO)?)[^\dA-Z]{0,6}(\d[\d.\s]{5,15}\d)/i) ??
    frontText.match(/\b(\d{1,3}(?:[.,]\d{3}){2,3})\b/) ??
    text.match(/\b(\d{1,3}(?:[.,]\d{3}){2,3})\b/) ??
    text.match(/\b(\d{7,12})\b/) ??
    text.match(/\b([A-Z]{1,3}\d{6,9}[A-Z]?)\b/);

  const mrz = parseMrz(backLines);

  // Fecha de nacimiento: la de la línea de "NACIMIENTO" (o la anterior) o, si no, la más antigua.
  let birthDate = mrz?.birthDate ?? null;
  if (!birthDate) {
    const i = all.findIndex((l) => /NACIMIENTO/i.test(l));
    const near = i >= 0 ? [all[i], all[i - 1], all[i + 1]].join(" ").match(DATE) : null;
    const dates = Array.from(text.matchAll(DATE), (m) => m[0]);
    birthDate = near?.[0] ?? dates.sort((a, b) => yearOf(a) - yearOf(b))[0] ?? null;
  }

  // Cédula amarilla: "1.75 O+ M" en una línea y "ESTATURA G.S. RH SEXO" en la siguiente.
  const labelIdx = all.findIndex((l) => /SEXO|G\.?\s?S\.?\s*RH/i.test(l));
  const valuesLine = labelIdx > 0 ? all[labelIdx - 1] : "";

  const sex =
    mrz?.sex ??
    text.match(/SEXO\s*[:.]?\s*([MF])\b/i)?.[1] ??
    valuesLine.match(/\b([MF])\s*$/i)?.[1] ??
    valuesLine.match(/[+-]\s*([MF])\b/i)?.[1] ??
    null;

  const blood =
    text.match(/(?:G\.?\s?S\.?|RH)[^A-Z0-9\n]{0,6}(AB|A|B|O|0)\s?([+-])/i) ??
    valuesLine.match(/\b(AB|A|B|O|0)\s?([+-])/i) ??
    text.match(/\b(AB|A|B|O|0)\s?([+-])\s*(?:G\.?\s?S|RH)/i);

  return {
    number: numberMatch ? numberMatch[1].replace(/\s/g, "") : null,
    surnames: valueNear(frontLines, /APELLIDO/i) ?? mrz?.surnames ?? null,
    names: valueNear(frontLines, /NOMBRE/i) ?? mrz?.names ?? null,
    birthDate,
    sex: sex ? (sex.toUpperCase() === "M" ? "Masculino" : "Femenino") : null,
    bloodType: blood ? `${blood[1].replace("0", "O").toUpperCase()}${blood[2]}` : null,
    raw: [frontLines.join("\n"), backLines.join("\n")].filter(Boolean).join("\n\n— Reverso —\n"),
  };
}

/** Prepara la imagen (escala de grises + contraste) para mejorar el OCR. */
function preprocess(source: HTMLCanvasElement): HTMLCanvasElement {
  const scale = Math.min(2, Math.max(1, 1400 / source.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = "grayscale(1) contrast(1.6) brightness(1.05)";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export type OcrEngine = {
  recognize: (source: HTMLCanvasElement) => Promise<string>;
  terminate: () => void;
};

/**
 * Crea un worker de Tesseract de inmediato (descarga motor + idioma en segundo plano)
 * para que esté listo cuando se capture el documento. Corre en un Web Worker: no bloquea la UI.
 */
export function createOcrEngine(onProgress: (p: number) => void): OcrEngine {
  let terminated = false;
  const worker = (async () => {
    const { createWorker } = await import("tesseract.js");
    return createWorker("spa", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") onProgress(m.progress);
      },
    });
  })();
  worker.catch(() => {});
  return {
    recognize: async (source) => {
      const w = await worker;
      if (terminated) throw new Error("terminated");
      const { data } = await w.recognize(preprocess(source));
      return data.text;
    },
    terminate: () => {
      terminated = true;
      worker.then((w) => w.terminate()).catch(() => {});
    },
  };
}
