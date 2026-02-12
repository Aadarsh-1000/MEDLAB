const fs = require("fs");
console.log("Loading HPO...");

const hpoData = JSON.parse(fs.readFileSync("full.json", "utf8"));
const hpoNodes = hpoData.graphs.flatMap(g => g.nodes || []);

const symptoms = hpoNodes
  .filter(n =>
    n.type === "CLASS" &&
    typeof n.id === "string" &&
    (n.id.startsWith("HP:") || n.id.includes("HP_")) &&
    n.lbl
  )
  .map(n => ({
    id: n.id.includes("HP_")
      ? "HP:" + n.id.split("HP_")[1]
      : n.id,
    name: n.lbl,
    definition: n.meta?.definition?.val || null,
    aliases: (n.meta?.synonyms || []).map(s => s.val),
    sources: n.meta?.definition?.xrefs || []
  }));

fs.writeFileSync("symptoms.json", JSON.stringify(symptoms, null, 2));
console.log("Saved", symptoms.length, "HPO symptoms");

console.log("Loading DOID...");

const text = fs.readFileSync("doid.obo", "utf8");
const blocks = text.split("\n[Term]\n");

const diseases = [];

for (const block of blocks) {
  if (!block.includes("id: DOID:")) continue;
  if (block.includes("is_obsolete: true")) continue;

  const id = block.match(/id:\s*(DOID:\d+)/)?.[1];
  const name = block.match(/name:\s*(.+)/)?.[1];
  if (!id || !name) continue;

  const defMatch = block.match(/def:\s*"([^"]+)"/);
  const defText = defMatch ? defMatch[1] : null;

  const aliases = [];
  const synRe = /synonym:\s*"(.+?)"/g;
  let m;
  while ((m = synRe.exec(block)) !== null) {
    aliases.push(m[1]);
  }

  diseases.push({
    id,
    name,
    aliases: [...new Set(aliases)],
    definition: defText
  });
}

fs.writeFileSync("diseases.json", JSON.stringify(diseases, null, 2));
console.log("Diseases parsed:", diseases.length);
console.log("Linking diseases to HPO symptoms...");

const lines = fs
  .readFileSync("phenotype.hpoa", "utf8")
  .split("\n")
  .filter(l => l && !l.startsWith("#"));

const diseaseToSymptoms = {};

for (const line of lines) {
  const cols = line.split("\t");
  if (cols.length < 5) continue;

  const diseaseDb = cols[0];   // OMIM / ORPHA
  const diseaseId = cols[1];
  const diseaseName = cols[2];
  const hpoId = cols[3];

  const key = `${diseaseDb}:${diseaseId}`;

  if (!diseaseToSymptoms[key]) {
    diseaseToSymptoms[key] = {
      id: key,
      name: diseaseName,
      symptoms: []
    };
  }

  diseaseToSymptoms[key].symptoms.push(hpoId);
}

// Deduplicate symptoms
for (const d of Object.values(diseaseToSymptoms)) {
  d.symptoms = [...new Set(d.symptoms)];
}

fs.writeFileSync(
  "disease_symptoms.json",
  JSON.stringify(diseaseToSymptoms, null, 2)
);

console.log(
  "Linked diseases:",
  Object.keys(diseaseToSymptoms).length
);
