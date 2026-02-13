const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

// Explicit preflight handler
app.options('*', cors());

app.use(express.json());

app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});
let diseasesData = { conditions: [] };

try {
  const raw = fs.readFileSync(path.join(__dirname, 'diseases.json'), 'utf8');
  diseasesData = JSON.parse(raw);
  console.log("✅ diseases.json loaded");
} catch (err) {
  console.error('❌ Failed to load diseases.json:', err.message);
}

app.post('/api/diagnose', (req, res) => {
  const { symptoms, age } = req.body;

  if (!Array.isArray(symptoms)) {
    return res.status(400).json({ error: 'symptoms must be an array' });
  }
  const matches = [];
  if (diseasesData.conditions) {
    for (const disease of diseasesData.conditions) {

      let matchCount = 0;

      for (const s of symptoms) {
        const ss = String(s).toLowerCase();

        if (disease.name?.toLowerCase().includes(ss))
          matchCount++;

        if (Array.isArray(disease.aliases)) {
          for (const a of disease.aliases) {
            if (String(a).toLowerCase().includes(ss)) {
              matchCount++;
              break;
            }
          }
        }
      }

      if (matchCount > 0) {
        matches.push({
          id: disease.id,
          name: disease.name,
          definition: disease.def || disease.definition || null,
          aliases: disease.aliases || [],
          matchedSymptoms: matchCount
        });
      }
    }
  }
  matches.sort((a, b) => b.matchedSymptoms - a.matchedSymptoms);
  res.json({
    symptoms,
    age: typeof age === 'number' ? age : null,
    totalMatches: matches.length,
    matches: matches.slice(0, 10)
  });
});
app.get('/api/diseases', (req, res) => {
  res.json(diseasesData);
});
app.all('/api/diagnose', (req, res) => {
  res.status(405).json({
    error: "Method Not Allowed",
    allowed: "POST"
  });
});

app.use(express.static(path.join(__dirname)));

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
