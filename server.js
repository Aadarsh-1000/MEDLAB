const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const synonymMap = require("./medical_synonyms");

// ---------------- LOGGER ----------------
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

// ---------------- LOAD OPEN DISEASE NAMES ----------------
let diseaseRealNames = {};
try {
  diseaseRealNames = JSON.parse(
    fs.readFileSync(path.join(__dirname, "open_disease_names.json"), "utf8")
  );
  console.log("✅ open disease names loaded:", Object.keys(diseaseRealNames).length);
} catch {
  console.log("⚠️ open_disease_names.json not found — using fallback names");
}

// ---------------- LOAD MEDICAL KNOWLEDGE ----------------
let symptomsIndex = [];
let diseaseSymptoms = {};

try {
  symptomsIndex = JSON.parse(
    fs.readFileSync(path.join(__dirname, "symptoms.json"), "utf8")
  );

  diseaseSymptoms = JSON.parse(
    fs.readFileSync(path.join(__dirname, "disease_symptoms.json"), "utf8")
  );

  console.log("✅ HPO symptoms loaded:", symptomsIndex.length);
  console.log("✅ Disease profiles loaded:", Object.keys(diseaseSymptoms).length);
} catch (e) {
  console.error("❌ Failed loading medical DB:", e.message);
}

// ---------------- BUILD SYMPTOM WEIGHTS ----------------
const symptomFrequency = {};
const totalDiseases = Object.keys(diseaseSymptoms).length || 1;

for (const disease of Object.values(diseaseSymptoms)) {
  for (const symptom of disease.symptoms || []) {
    const hpo = typeof symptom === "string" ? symptom : symptom.id;
    symptomFrequency[hpo] = (symptomFrequency[hpo] || 0) + 1;
  }
}

function symptomWeight(hpo) {
  const freq = symptomFrequency[hpo] || 1;
  return Math.log(totalDiseases / freq);
}

// ---------------- WORD NORMALIZATION ----------------
function expandWords(words) {
  const expanded = [];

  for (const w of words) {
    const key = String(w).toLowerCase().replace(/\s/g, "");
    expanded.push(w);

    if (synonymMap[key]) expanded.push(...synonymMap[key]);
  }

  return [...new Set(expanded)];
}

// ---------------- FUZZY MATCH ----------------
function similarity(a, b) {
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const aw = a.split(" ");
  const bw = b.split(" ");

  let common = 0;
  for (const w of aw) if (bw.includes(w)) common++;

  return common / Math.max(aw.length, bw.length);
}

// ---------------- MAP WORDS → HPO IDs ----------------
function mapWordsToHPO(words) {
  const expanded = expandWords(words);
  const matched = new Set();

  for (const w of expanded) {
    for (const s of symptomsIndex) {
      const candidates = [s.name, ...(s.aliases || [])];

      for (const c of candidates) {
        if (similarity(w, c) > 0.6) {
          matched.add(s.id);
          break;
        }
      }
    }
  }

  return [...matched];
}

// ---------------- HUMAN FRIENDLY NAME ----------------
function resolveDiseaseName(disease) {
  if (diseaseRealNames[disease.id]) return diseaseRealNames[disease.id];
  if (disease.name) return disease.name;

  if (disease.id?.startsWith("OMIM:"))
    return `Rare genetic disorder (OMIM ${disease.id.split(":")[1]})`;

  if (disease.id?.startsWith("ORPHA:"))
    return `Rare disease (Orphanet ${disease.id.split(":")[1]})`;

  return disease.id || "Unknown disease";
}

// ---------------- DIAGNOSIS ENGINE ----------------
app.post("/api/diagnose", (req, res) => {
  const { symptoms, age } = req.body;

  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ error: "No symptoms provided" });
  }

  // Step 1: human → HPO
  const hpoTerms = mapWordsToHPO(symptoms);

  if (hpoTerms.length === 0) {
    return res.json({
      message: "No clinical symptoms recognized",
      recognizedSymptoms: 0,
      inputSymptoms: symptoms,
      matches: []
    });
  }

  const results = [];

  // Step 2: weighted scoring
  for (const disease of Object.values(diseaseSymptoms)) {
    const rawSymptoms = disease.symptoms || [];
    const hpoOnly = rawSymptoms.map(s =>
      typeof s === "string" ? s : s.id
    );

    let score = 0;
    const matchedSymptoms = [];

    for (const h of hpoTerms) {
      if (hpoOnly.includes(h)) {
        score += symptomWeight(h);

        const full = rawSymptoms.find(s =>
          (typeof s === "string" ? s : s.id) === h
        );

       if (full) {
  if (typeof full === "object" && full.name) {
    matchedSymptoms.push(full.name);
  } else {
    const lookup = symptomsIndex.find(x => x.id === h);
    matchedSymptoms.push(lookup ? lookup.name : h);
  }
}

      }
    }

    if (score > 0) {
      results.push({
        id: disease.id,
        name: resolveDiseaseName(disease),
        weightedScore: Number(score.toFixed(3)),
        confidence: Math.min(100, Math.round(score * 12)),
        matchedSymptoms
      });
    }
  }

  results.sort((a, b) => b.weightedScore - a.weightedScore);

  res.json({
    recognizedSymptoms: hpoTerms.length,
    inputSymptoms: symptoms,
    age: age ?? null,
    matches: results.slice(0, 10)
  });
});

// ---------------- STATIC + ROUTES ----------------
app.use(express.static(path.join(__dirname)));

app.all("/api/diagnose", (req, res) => {
  res.status(405).json({ error: "Method Not Allowed", allowed: "POST" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
