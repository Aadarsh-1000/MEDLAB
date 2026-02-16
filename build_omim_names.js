const fs = require("fs");

const lines = fs.readFileSync("phenotype.hpoa","utf8").split("\n");

const map = {};

for (const line of lines) {
  if (!line || line.startsWith("#")) continue;

  const cols = line.split("\t");
  if (cols.length < 3) continue;

  const db = cols[0];        // OMIM
  const id = cols[1];        // 621304
  const name = cols[2];      // real disease name

  if (db && id && name) {
    map[`${db}:${id}`] = name;
  }
}

fs.writeFileSync("disease_names.json", JSON.stringify(map,null,2));

console.log("Saved", Object.keys(map).length, "disease names");
