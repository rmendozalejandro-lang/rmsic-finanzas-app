const fs = require("fs");
const path = "app/(private)/ot/nueva/page.tsx";

const backup = `${path}.bak-encoding-node`;
fs.copyFileSync(path, backup);

let content = fs.readFileSync(path, "utf8");

const replacements = [
  ["\u00c3\u00a1", "\u00e1"], // á
  ["\u00c3\u00a9", "\u00e9"], // é
  ["\u00c3\u00ad", "\u00ed"], // í
  ["\u00c3\u00b3", "\u00f3"], // ó
  ["\u00c3\u00ba", "\u00fa"], // ú
  ["\u00c3\u00b1", "\u00f1"], // ñ

  ["\u00c3\u0081", "\u00c1"], // Á
  ["\u00c3\u0089", "\u00c9"], // É
  ["\u00c3\u008d", "\u00cd"], // Í
  ["\u00c3\u0093", "\u00d3"], // Ó
  ["\u00c3\u009a", "\u00da"], // Ú
  ["\u00c3\u0091", "\u00d1"], // Ñ

  ["\u00c2\u00b0", "\u00b0"], // °
  ["\u00c2\u00ba", "\u00b0"], // º -> °
  ["\u00c2\u00bf", "\u00bf"], // ¿
  ["\u00c2\u00a1", "\u00a1"], // ¡
  ["\u00c2\u00b7", "\u00b7"], // ·
  ["\u00c2\u00a0", " "],      // espacio raro
];

for (const [bad, good] of replacements) {
  content = content.split(bad).join(good);
}

// Correcciones puntuales por si quedó algún texto parcialmente dañado
content = content
  .replace(/T\u00c3.?cnico/g, "Técnico")
  .replace(/t\u00c3.?cnico/g, "técnico")
  .replace(/Configuraci\u00c3.?n/g, "Configuración")
  .replace(/configuraci\u00c3.?n/g, "configuración")
  .replace(/informaci\u00c3.?n/g, "información")
  .replace(/Informaci\u00c3.?n/g, "Información")
  .replace(/acci\u00c3.?n/g, "acción")
  .replace(/env\u00c3.?o/g, "envío")
  .replace(/despu\u00c3.?s/g, "después")
  .replace(/autom\u00c3.?ticamente/g, "automáticamente")
  .replace(/autom\u00c3.?tica/g, "automática")
  .replace(/cat\u00c3.?logos/g, "catálogos")
  .replace(/mantenci\u00c3.?n/g, "mantención")
  .replace(/protecci\u00c3.?n/g, "protección")
  .replace(/Observaci\u00c3.?n/g, "Observación")
  .replace(/observaci\u00c3.?n/g, "observación")
  .replace(/ejecuci\u00c3.?n/g, "ejecución")
  .replace(/condici\u00c3.?n/g, "condición")
  .replace(/coordinaci\u00c3.?n/g, "coordinación")
  .replace(/Asignaci\u00c3.?n/g, "Asignación")
  .replace(/selecci\u00c3.?nalo/g, "selecciónalo")
  .replace(/Selecci\u00c3.?n/g, "Selección")
  .replace(/selecci\u00c3.?n/g, "selección")
  .replace(/L\u00c3.?nea/g, "Línea")
  .replace(/Conversi\u00c3.?n/g, "Conversión")
  .replace(/Cr\u00c3.?tica/g, "Crítica")
  .replace(/\u00c3.?rea/g, "Área")
  .replace(/t\u00c3.?tulo/g, "título")
  .replace(/T\u00c3.?tulo/g, "Título")
  .replace(/N\u00c2.?[°º]/g, "N°")
  .replace(/\u00c2.?·/g, "·");

fs.writeFileSync(path, content, "utf8");

console.log(`Archivo reparado: ${path}`);
console.log(`Respaldo creado: ${backup}`);
