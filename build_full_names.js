const fs = require("fs");

const text = fs.readFileSync("doid.obo","utf8");
const blocks = text.split("\n[Term]\n");

const map = {};

for(const block of blocks){

  const name = block.match(/name:\s*(.+)/)?.[1];
  if(!name) continue;

  const omimMatches = [...block.matchAll(/xref:\s*OMIM:(\d+)/g)];

  for(const m of omimMatches){
    map["OMIM:"+m[1]] = name;
  }

  const orphaMatches = [...block.matchAll(/xref:\s*Orphanet:(\d+)/g)];

  for(const m of orphaMatches){
    map["ORPHA:"+m[1]] = name;
  }
}

fs.writeFileSync("disease_names_full.json", JSON.stringify(map,null,2));

console.log("Mapped diseases:",Object.keys(map).length);
