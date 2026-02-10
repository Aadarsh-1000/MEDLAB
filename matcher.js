const fs = require("fs");

/* =========================
   LOAD DATA
========================= */
const commonDiseaseMap = JSON.parse(
  fs.readFileSync("common_diseases.json", "utf8")
);

const diseaseMap = JSON.parse(
  fs.readFileSync("disease_symptoms.json", "utf8")
);

/* =========================
   TIER 1: COMMON DISEASES
========================= */
function matchCommonDiseases(userSymptoms, limit = 5) {
  const results = [];

  for (const disease of Object.values(commonDiseaseMap)) {
    const matches = disease.symptoms.filter(s =>
      userSymptoms.includes(s)
    );

    if (matches.length < 1) continue;

    const score = matches.length / disease.symptoms.length;

    results.push({
      id: disease.id,
      name: disease.name,
      score: Number(score.toFixed(3)),
      matched: matches.length,
      total: disease.symptoms.length
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* =========================
   MASTER MATCHER
========================= */
function matchDiseases(userSymptoms) {
  const commonResults = matchCommonDiseases(userSymptoms);

  if (commonResults.length > 0) {
    return { tier: "common", results: commonResults };
  }

  return { tier: "none", results: [] };
}

/* =========================
   TEST (CORRECT IDS)
========================= */
const userSymptoms = [
  "HP:0001945", // Fever
  "HP:0002099", // Cough
  "HP:0033050"  // Sore throat (CORRECT)s
];

console.log(JSON.stringify(matchDiseases(userSymptoms), null, 2));
