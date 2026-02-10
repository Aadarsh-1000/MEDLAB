const fs = require("fs");

// read the OBO file
const text = fs.readFileSync("doid.obo", "utf8");

// split into [Term] blocks
const blocks = text.split("\n[Term]\n");

const conditions = [];

for (const block of blocks) {
  // skip invalid / obsolete terms
  if (!block.includes("id: DOID:")) continue;
  if (block.includes("is_obsolete: true")) continue;

  const id = block.match(/id:\s*(DOID:\d+)/)?.[1];
  const name = block.match(/name:\s*(.+)/)?.[1];

  if (!id || !name) continue;

  // extract synonyms
  const aliases = [];
  const synRe = /synonym:\s*"(.+?)"/g;
  let m;
  while ((m = synRe.exec(block)) !== null) {
    aliases.push(m[1]);
  }

  // extract ICD-10 if present
  const icdMatch = block.match(/xref:\s*ICD10:([A-Z0-9.]+)/);
  const ICD10 = icdMatch ? icdMatch[1] : "";

  conditions.push({
    id,
    name,
    aliases,
    features: {
      present: {},
      absent: {}
    },
    meta: {
      ICD10
    }
  });
}

// write JSON output
fs.writeFileSync(
  "diseases.json",
  JSON.stringify({ conditions }, null, 2),
  "utf8"
);

console.log("Diseases converted:", conditions.length);
console.log("Output written to diseases.json");
