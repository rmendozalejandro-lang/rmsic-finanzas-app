const fs = require("fs");

const path = "components/ot/ot-pdf-document.tsx";
const backup = `${path}.bak-mojibake-final`;

fs.copyFileSync(path, backup);

let content = fs.readFileSync(path, "utf8");

const replacements = [
  // Doble mojibake UTF-8/Windows-1252
  ["\u00c3\u0192\u00c2\u00a1", "\u00e1"],
  ["\u00c3\u0192\u00c2\u00a9", "\u00e9"],
  ["\u00c3\u0192\u00c2\u00ad", "\u00ed"],
  ["\u00c3\u0192\u00c2\u00b3", "\u00f3"],
  ["\u00c3\u0192\u00c2\u00ba", "\u00fa"],
  ["\u00c3\u0192\u00c2\u00b1", "\u00f1"],

  ["\u00c3\u0192\u00c2\u0081", "\u00c1"],
  ["\u00c3\u0192\u00c2\u0089", "\u00c9"],
  ["\u00c3\u0192\u00c2\u008d", "\u00cd"],
  ["\u00c3\u0192\u00c2\u0093", "\u00d3"],
  ["\u00c3\u0192\u00c2\u009a", "\u00da"],
  ["\u00c3\u0192\u00c2\u0091", "\u00d1"],

  // Variantes que PowerShell muestra como â€œ / â€°
  ["\u00c3\u0192\u00e2\u20ac\u0153", "\u00d3"],
  ["\u00c3\u0192\u00e2\u20ac\u00b0", "\u00c9"],

  // Mojibake simple
  ["\u00c3\u00a1", "\u00e1"],
  ["\u00c3\u00a9", "\u00e9"],
  ["\u00c3\u00ad", "\u00ed"],
  ["\u00c3\u00b3", "\u00f3"],
  ["\u00c3\u00ba", "\u00fa"],
  ["\u00c3\u00b1", "\u00f1"],

  ["\u00c3\u0081", "\u00c1"],
  ["\u00c3\u0089", "\u00c9"],
  ["\u00c3\u008d", "\u00cd"],
  ["\u00c3\u0093", "\u00d3"],
  ["\u00c3\u009a", "\u00da"],
  ["\u00c3\u0091", "\u00d1"],

  ["\u00c2\u00b0", "\u00b0"],
  ["\u00c2\u00ba", "\u00b0"],
  ["\u00c2\u00bf", "\u00bf"],
  ["\u00c2\u00a1", "\u00a1"],
  ["\u00c2\u00b7", "\u00b7"],
  ["\u00c2\u00a0", " "],
  ["\u00c3\u201a\u00c2\u00b7", "\u00b7"],

  // Checks dañados
  ["\u00c3\u00a2\u00cb\u0153\u00e2\u20ac\u02dc", "\u2611"],
  ["\u00e2\u02dc\u2018", "\u2611"],
];

for (const [bad, good] of replacements) {
  content = content.split(bad).join(good);
}

// Correcciones puntuales del PDF
content = content
  .replace(/Ra.{0,8}l Mendoza/g, "Ra\u00fal Mendoza")
  .replace(/Ingenier.{0,8}a/g, "Ingenier\u00eda")
  .replace(/INGENIER.{0,8}A/g, "INGENIER\u00cdA")
  .replace(/Construcci.{0,8}n/g, "Construcci\u00f3n")
  .replace(/CONSTRUCCI.{0,8}N/g, "CONSTRUCCI\u00d3N")
  .replace(/protecci.{0,8}n/g, "protecci\u00f3n")
  .replace(/Observaci.{0,8}n/g, "Observaci\u00f3n")
  .replace(/observaci.{0,8}n/g, "observaci\u00f3n")
  .replace(/fotogr.{0,8}fico/g, "fotogr\u00e1fico")
  .replace(/FOTOGR.{0,8}FICO/g, "FOTOGR\u00c1FICO")
  .replace(/asesor.{0,8}a/g, "asesor\u00eda")
  .replace(/ASESOR.{0,8}A/g, "ASESOR\u00cdA")
  .replace(/t.{0,6}cnico/g, "t\u00e9cnico")
  .replace(/T.{0,6}cnico/g, "T\u00e9cnico")
  .replace(/T.{0,6}CNICOS/g, "T\u00c9CNICOS")
  .replace(/Raz.{0,6}n social/g, "Raz\u00f3n social")
  .replace(/t.{0,6}rmino/g, "t\u00e9rmino")
  .replace(/.{0,4}rea \/ sector/g, "\u00c1rea / sector")
  .replace(/Soluci.{0,8}n/g, "Soluci\u00f3n")
  .replace(/atenci.{0,8}n/g, "atenci\u00f3n")
  .replace(/cotizaci.{0,8}n/g, "cotizaci\u00f3n")
  .replace(/An.{0,6}lisis/g, "An\u00e1lisis")
  .replace(/Diagn.{0,8}stico/g, "Diagn\u00f3stico")
  .replace(/Despu.{0,8}s/g, "Despu\u00e9s")
  .replace(/RECEPCI.{0,8}N/g, "RECEPCI\u00d3N")
  .replace(/recepci.{0,8}n/g, "recepci\u00f3n");

// Fuerza la línea de checklist a una versión limpia
content = content.replace(
  /return `\$\{checked \?[\s\S]*?\$\{item\.codigo\} \$\{item\.label\}`/,
  "return `${checked ? '\u2611' : '\u2610'} ${item.codigo} ${item.label}`"
);

fs.writeFileSync(path, content, "utf8");

console.log(`Archivo reparado: ${path}`);
console.log(`Respaldo creado: ${backup}`);
