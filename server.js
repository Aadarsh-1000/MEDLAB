import fs from "fs";
import path from "path";
import synonymMap from "../medical_synonyms.js";

/* =========================
   LOAD DATA (ONCE PER COLD START)
========================= */
const basePath = process.cwd();

let symptomsIndex = [];
let diseaseSymptoms = {};
let diseaseRealNames = {};

try {
  symptomsIndex = JSON.parse(
    fs.readFileSync(path.join(basePath, "symptoms.json"), "utf8")
  );

  diseaseSymptoms = JSON.parse(
    fs.readFileSync(path.join(basePath, "disease_symptoms.json"), "utf8")
  );
} catch (err) {
  console.error("Failed loading medical data:", err.message);
}

try {
  diseaseRealNames = JSON.parse(
    fs.readFileSync(path.join(basePath, "open_disease_names.json"), "utf8")
  );
} catch {
  diseaseRealNames = {};
}

/* =========================
   TF-IDF PRECOMPUTE
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
  return Math.log(totalDiseases / (symptomFrequency[hpo] || 1));
}

/* =========================
   TEXT MATCHING
========================= */
function expandWords(words) {
  const out = new Set();
  for (const w of words) {
    const key = String(w).toLowerCase().replace(/\s/g, "");
    out.add(w);
    if (synonymMap[key]) synonymMap[key].forEach(x => out.add(x));
  }
  return [...out];
}

function similarity(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const aw = a.split(" ");
  const bw = b.split(" ");
  const common = aw.filter(w => bw.includes(w)).length;
  return common / Math.max(aw.length, bw.length);
}

function mapWordsToHPO(words) {
  const expanded = expandWords(words);
  const matched = new Set();

  for (const w of expanded) {
    for (const s of symptomsIndex) {
      for (const c of [s.name, ...(s.aliases || [])]) {
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
   DEMOGRAPHICS
========================= */
const FEMALE_ONLY = ["ovary","uterus","cervix","pregnancy","menstrual","pcos"];
const MALE_ONLY = ["prostate","testicular","penile"];
const PEDIATRIC = ["pediatric","childhood","infant","neonatal","congenital"];
const ADULT_ONLY = ["adult onset","late onset","senile"];

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
  if (age < 18) return !ADULT_ONLY.some(k => n.includes(k));
  return !PEDIATRIC.some(k => n.includes(k));
}

function resolveName(d) {
  return diseaseRealNames[d.id] || d.name || d.id;
}

/* =========================
   SERVERLESS HANDLER
========================= */
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { symptoms, age, gender } = req.body;

  if (!Array.isArray(symptoms) || symptoms.length < 2) {
    return res.json({ matches: [] });
  }

  const userHPOs = mapWordsToHPO(symptoms);
  if (!userHPOs.length) return res.json({ matches: [] });

  const results = [];

  for (const disease of Object.values(diseaseSymptoms)) {
    const name = disease.name || "";
    if (!genderCompatible(name, gender)) continue;
    if (!ageCompatible(name, age)) continue;

    const diseaseHPOs = (disease.symptoms || []).map(s =>
      typeof s === "string" ? s : s.id
    );

    let score = 0;
    const matched = [];

    for (const h of userHPOs) {
      if (diseaseHPOs.includes(h)) {
        score += symptomWeight(h);
        const s = symptomsIndex.find(x => x.id === h);
        matched.push(s ? s.name : h);
      }
    }

    if (score > 0) {
      results.push({
        name: resolveName(disease),
        confidence: Math.min(100, Math.round(score * 12)),
        matchedSymptoms: matched
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);

  res.json({ matches: results.slice(0, 10) });
}