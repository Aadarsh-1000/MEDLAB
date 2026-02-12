const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   LOAD COMMON DISEASES
========================= */
let commonDiseaseMap = {};
try {
  commonDiseaseMap = JSON.parse(
    fs.readFileSync(path.join(__dirname, "common_diseases.json"), "utf8")
  );
  console.log("Loaded common diseases");
} catch (err) {
  console.error("Failed to load common_diseases.json:", err.message);
}

/* =========================
   SYMPTOM → HPO MAP
   (minimal, expandable)
========================= */
const symptomToHPO = {
  "cough": "HP:0002099",
  "runny nose": "HP:0002840",
  "nasal congestion": "HP:0002840",
  "sore throat": "HP:0033050",
  "fatigue": "HP:0012378",
  "fever": "HP:0001945",
  "headache": "HP:0000823"
};

/* =========================
   DIAGNOSIS ENDPOINT
========================= */
app.post("/api/diagnose", (req, res) => {
  const { symptoms } = req.body;

  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({
      error: "symptoms must be a non-empty array"
    });
  }

  // convert text symptoms → HPO IDs
  const userHPOs = symptoms
    .map(s => symptomToHPO[s.toLowerCase()])
    .filter(Boolean);

  if (userHPOs.length === 0) {
    return res.json({
      inputSymptoms: symptoms,
      mappedHPOs: [],
      matches: []
    });
  }

  const results = [];

  for (const disease of Object.values(commonDiseaseMap)) {
    const diseaseHPOs = disease.symptoms;

    const matched = diseaseHPOs.filter(hpo =>
      userHPOs.includes(hpo)
    );

    if (matched.length === 0) continue;

    const score = matched.length / diseaseHPOs.length;

    results.push({
      id: disease.id,
      name: disease.name,
      matchedSymptoms: matched.length,
      totalSymptoms: diseaseHPOs.length,
      score: Number(score.toFixed(2)),
      matchedHPOs: matched
    });
  }

  results.sort((a, b) => b.score - a.score);

  res.json({
    inputSymptoms: symptoms,
    mappedHPOs: userHPOs,
    totalMatches: results.length,
    matches: results
  });
});

/* =========================
   PING (TEST)
========================= */
app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
