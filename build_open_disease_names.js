const fs = require("fs");

const text = fs.readFileSync("doid.obo","utf8");
const terms = text.split("\n[Term]\n");

const map = {};

for(const term of terms){

  const nameMatch = term.match(/\nname:\s(.+)/);
  if(!nameMatch) continue;

  const name = nameMatch[1].trim();

  // capture ALL xrefs
  const xrefs = [...term.matchAll(/\nxref:\s([A-Za-z]+):(\d+)/g)];

  for(const x of xrefs){
    const db = x[1];
    const id = x[2];

    if(db === "OMIM" || db === "Orphanet" || db === "ORDO"){
      map[`${db.toUpperCase()}:${id}`] = name;
    }
  }
}

fs.writeFileSync("open_disease_names.json", JSON.stringify(map,null,2));

console.log("Mapped open diseases:", Object.keys(map).length);
