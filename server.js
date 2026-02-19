const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------------- LOGGER ----------------
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

// ---------------- LOAD SYNONYMS ----------------
const synonymMap = require("./medical_synonyms");

// ---------------- LOAD OPEN DISEASE NAMES ----------------
let diseaseRealNames = {};
try {
  diseaseRealNames = JSON.parse(
    fs.readFileSync(path.join(__dirname, "open_disease_names.json"), "utf8")
  );
  console.log("✅ Open disease names loaded");
} catch {
  console.log("⚠️ open_disease_names.json not found");
}

// ---------------- LOAD MEDICAL DATA ----------------
let symptomsIndex = [];
let diseaseSymptoms = {};

try {
  symptomsIndex = JSON.parse(
    fs.readFileSync(path.join(__dirname, "symptoms.json"), "utf8")
  );

  diseaseSymptoms = JSON.parse(
    fs.readFileSync(path.join(__dirname, "disease_symptoms.json"), "utf8")
  );

  console.log("✅ Symptoms loaded:", symptomsIndex.length);
  console.log("✅ Diseases loaded:", Object.keys(diseaseSymptoms).length);
} catch (err) {
  console.error("❌ Failed loading data:", err.message);
}

// ---------------- BUILD SYMPTOM WEIGHTS ----------------
const symptomFrequency = {};
const totalDiseases = Object.keys(diseaseSymptoms).length || 1;

for (const disease of Object.values(diseaseSymptoms)) {
  for (const s of disease.symptoms || []) {
    const hpo = typeof s === "string" ? s : s.id;
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
  a = a.toLowerCase();
  b = b.toLowerCase();

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const aw = a.split(" ");
  const bw = b.split(" ");

  let common = 0;
  for (const w of aw) if (bw.includes(w)) common++;

  return common / Math.max(aw.length, bw.length);
}

// ---------------- MAP WORDS → HPO ----------------
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

// ---------------- NAME RESOLUTION ----------------
function resolveDiseaseName(disease) {
  if (diseaseRealNames[disease.id]) return diseaseRealNames[disease.id];
  if (disease.name) return disease.name;
  return disease.id || "Unknown disease";
}

// ---------------- GENDER FILTERING ----------------
const FEMALE_ONLY_KEYWORDS = [
  "ovary", "ovarian", "uterus", "uterine", "cervix", "cervical",
  "endometriosis", "pregnancy", "menstrual", "pcos", "vaginal"
];

const MALE_ONLY_KEYWORDS = [
  "prostate", "testicular", "testis", "penile",
  "erectile", "sperm", "scrotal"
];
const PEDIATRIC_KEYWORDS = [
  "pediatric",
  "childhood",
  "infant",
  "neonatal",
  "congenital",
  "juvenile",
  "inborn"
];

const ADULT_ONLY_KEYWORDS = [
  "adult onset",
  "adult-onset",
  "late onset",
  "age-related",
  "senile"
];

function isGenderCompatible(name, gender) {
  if (!gender) return true;

  const n = name.toLowerCase();

  if (gender === "male") {
    return !FEMALE_ONLY_KEYWORDS.some(k => n.includes(k));
  }

  if (gender === "female") {
    return !MALE_ONLY_KEYWORDS.some(k => n.includes(k));
  }

  return true;
}
function isAgeCompatible(name, age) {
  if (!age) return true;

  const n = name.toLowerCase();

  // Adults should not see pediatric-only diseases
  if (age >= 18) {
    return !PEDIATRIC_KEYWORDS.some(k => n.includes(k));
  }

  // Children should not see adult-only diseases
  if (age < 18) {
    return !ADULT_ONLY_KEYWORDS.some(k => n.includes(k));
  }

  return true;
}


function isAgeCompatible(diseaseName, age) {
  if (!age) return true;

  const name = diseaseName.toLowerCase();

  // Pediatric-only diseases
  if (age >= 18) {
    for (const word of PEDIATRIC_KEYWORDS) {
      if (name.includes(word)) return false;
    }
  }

  // Adult-only diseases
  if (age < 18) {
    for (const word of ADULT_ONLY_KEYWORDS) {
      if (name.includes(word)) return false;
    }
  }

  return true;
}


// ---------------- DIAGNOSIS API ----------------
app.post("/api/diagnose", (req, res) => {
  const { symptoms, age, gender } = req.body;

  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ error: "No symptoms provided" });
  }

  const hpoTerms = mapWordsToHPO(symptoms);
  if (hpoTerms.length === 0) {
    return res.json({ matches: [] });
  }

  const results = [];

  for (const disease of Object.values(diseaseSymptoms)) {
    const diseaseName = disease.name || "";

    if (!isGenderCompatible(diseaseName, gender)) continue;

    const raw = disease.symptoms || [];
    const hpoOnly = raw.map(s => (typeof s === "string" ? s : s.id));

    let score = 0;
    const matchedSymptoms = [];

    for (const h of hpoTerms) {
      if (hpoOnly.includes(h)) {
        score += symptomWeight(h);
        const lookup = symptomsIndex.find(x => x.id === h);
        matchedSymptoms.push(lookup ? lookup.name : h);
      }
    }

    if (score > 0) {
      results.push({
        id: disease.id,
        name: resolveDiseaseName(disease),
        confidence: Math.min(100, Math.round(score * 12)),
        matchedSymptoms
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);

  res.json({
    age: age ?? null,
    gender: gender ?? null,
    matches: results.slice(0, 10)
  });
});

// ---------------- STATIC + ERRORS ----------------
app.use(express.static(path.join(__dirname)));

app.all("/api/diagnose", (req, res) => {
  res.status(405).json({ error: "POST only" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
