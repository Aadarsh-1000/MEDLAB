const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Request logger
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

/* =========================
   LOAD DATA
========================= */
let symptomsIndex = [];
let diseaseSymptoms = {};
let diseaseRealNames = {};

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
  console.error("❌ Failed loading medical data:", err.message);
}

try {
  diseaseRealNames = JSON.parse(
    fs.readFileSync(path.join(__dirname, "open_disease_names.json"), "utf8")
  );
  console.log("✅ Disease names loaded");
} catch {
  console.log("⚠️ open_disease_names.json not found");
}

/* =========================
   SYNONYMS
========================= */
const synonymMap = require("./medical_synonyms");

/* =========================
   SYMPTOM WEIGHTS (TF-IDF)
========================= */
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

/* =========================
   TEXT NORMALIZATION
========================= */
function expandWords(words) {
  const expanded = [];
  for (const w of words) {
    const key = String(w).toLowerCase().replace(/\s/g, "");
    expanded.push(w);
    if (synonymMap[key]) expanded.push(...synonymMap[key]);
  }
  return [...new Set(expanded)];
}

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

/* =========================
   DEMOGRAPHIC FILTERS
========================= */
const FEMALE_ONLY = ["ovary", "uterus", "cervix", "pregnancy", "menstrual", "pcos"];
const MALE_ONLY = ["prostate", "testicular", "penile"];
const PEDIATRIC = ["pediatric", "childhood", "infant", "neonatal", "congenital"];
const ADULT_ONLY = ["adult onset", "late onset", "senile"];

function genderCompatible(name, gender) {
  if (!gender) return true;
  const n = name.toLowerCase();
  if (gender === "male") return !FEMALE_ONLY.some(k => n.includes(k));
  if (gender === "female") return !MALE_ONLY.some(k => n.includes(k));
  return true;
}

function ageCompatible(name, age) {
  if (!age) return true;
  const n = name.toLowerCase();
  if (age >= 18) return !PEDIATRIC.some(k => n.includes(k));
  if (age < 18) return !ADULT_ONLY.some(k => n.includes(k));
  return true;
}

function resolveDiseaseName(d) {
  return diseaseRealNames[d.id] || d.name || d.id || "Unknown disease";
}

/* =========================
   DIAGNOSIS API (FIXED)
========================= */
const SIMPLE_PRESENTATION_LIMIT = 3;

app.post("/api/diagnose", (req, res) => {
  const { symptoms, age, gender } = req.body;

  if (!Array.isArray(symptoms) || symptoms.length < 2) {
    return res.json({
      note: "Add more symptoms for better accuracy",
      matches: []
    });
  }

  const userHPOs = mapWordsToHPO(symptoms);
  if (userHPOs.length === 0) {
    return res.json({ matches: [] });
  }

  const simpleCase = userHPOs.length <= SIMPLE_PRESENTATION_LIMIT;
  const results = [];

  for (const disease of Object.values(diseaseSymptoms)) {
    const name = disease.name || "";
    if (!genderCompatible(name, gender)) continue;
    if (!ageCompatible(name, age)) continue;

    const diseaseHPOs = (disease.symptoms || []).map(s =>
      typeof s === "string" ? s : s.id
    );

    let score = 0;
    const matchedSymptoms = [];

    for (const h of userHPOs) {
      if (diseaseHPOs.includes(h)) {
        score += symptomWeight(h);
        const s = symptomsIndex.find(x => x.id === h);
        matchedSymptoms.push(s ? s.name : h);
      }
    }

    if (score <= 0) continue;

    const isCommon = disease.id?.startsWith("COMMON");

    // 🚫 hide rare diseases for simple symptom sets
    if (simpleCase && !isCommon) continue;

    // 🎯 boost common diseases
    if (isCommon) score *= 1.8;

    results.push({
      id: disease.id,
      name: resolveDiseaseName(disease),
      confidence: Math.min(100, Math.round(score * 12)),
      matchedSymptoms
    });
  }

  results.sort((a, b) => b.confidence - a.confidence);

  res.json({
    age: age ?? null,
    gender: gender ?? null,
    note: simpleCase
      ? "Results prioritise common conditions. Add more symptoms for rare diseases."
      : null,
    matches: results.slice(0, 10)
  });
});

/* =========================
   SAFETY ROUTES
========================= */
app.all("/api/diagnose", (req, res) => {
  res.status(405).json({ error: "POST only" });
  console.log("Mapped HPOs:", userHPOs);
});



app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
