const selector = document.getElementById('symptoms');

const symArray = [
  'fever','cough','sore throat','runny nose','headache','myalgia',
  'fatigue','shortness of breath','chest pain','abdominal pain',
  'nausea','vomiting','diarrhoea','dysuria','frequency','rash',
  'joint pain','anosmia','loss of taste','photophobia','rigors',
  'night sweats','wheeze','flank pain','back pain','dizziness',
  'syncope','hematuria','jaundice','weight loss'
];

let symps = [];

// ---------------- AGE SYNC ----------------
let selectedAge = null;
const slider = document.getElementById('slider');
const ageInput = document.getElementById('age-input');

function syncAgeFrom(v) {
  const n = Number(v) || 0;
  selectedAge = n;
  if (slider && Number(slider.value) !== n) slider.value = n;
  if (ageInput && Number(ageInput.value) !== n) ageInput.value = n;
}

if (slider) {
  syncAgeFrom(slider.value);
  slider.addEventListener('input', e => syncAgeFrom(e.target.value));
}

if (ageInput) {
  syncAgeFrom(ageInput.value);
  ageInput.addEventListener('input', e => {
    let v = e.target.value;
    if (v === '') return;
    v = Math.max(Number(ageInput.min || 0), Math.min(Number(ageInput.max || 120), Number(v)));
    syncAgeFrom(v);
  });
}

// ---------------- POPULATE SYMPTOMS ----------------
symArray.forEach(sym => {
  const option = document.createElement('option');
  option.textContent = sym;
  option.value = sym;
  selector.appendChild(option);
});

// ---------------- SYMPTOM SELECTION ----------------
selector.addEventListener('change', () => {
  const display = document.querySelector('.symbox');
  if (!display) return;

  const selSym = selector.value;
  if (!selSym) return;

  if (symps.includes(selSym)) {
    alert('Same symptom cannot be placed twice.');
    return;
  }

  if (display.querySelectorAll('.symptoms').length >= 10) {
    alert('Can only upload up to 10 symptoms.');
    return;
  }

  const el = document.createElement('div');
  el.className = 'symptoms';
  el.textContent = selSym;
  el.dataset.symptom = selSym;

  symps.push(selSym);
  display.appendChild(el);
});

// ---------------- DIAGNOSE ----------------
async function diagnoseSymptoms() {
  if (symps.length === 0) {
    alert('Please select at least one symptom');
    return;
  }

  const payload = {
    symptoms: symps,
    age: selectedAge,
    gender: selectedGender
  };

  try {
    const res = await fetch('http://localhost:3000/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Server error');

    const data = await res.json();
    displayDiagnosisResults(data);
  } catch (err) {
    console.error(err);
    alert('Failed to get diagnosis. Is the backend running?');
  }
}

// ---------------- RESULTS ----------------
function displayDiagnosisResults(data) {
  const container = document.getElementById('diagnosis-results');
  if (!container) return;

  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Top probable conditions';
  container.appendChild(title);

  if (!data.matches || data.matches.length === 0) {
    container.appendChild(document.createElement('p')).textContent = 'No matches found.';
    return;
  }

  data.matches.forEach(match => {
    const el = document.createElement('div');
    el.className = 'result-item';
    el.innerHTML = `
      <h3>${match.name}</h3>
      <p><strong>Confidence:</strong> ${match.confidence}%</p>
      <p><strong>Matched symptoms:</strong> ${match.matchedSymptoms.join(', ')}</p>
    `;
    container.appendChild(el);
  });
}

// ---------------- BUTTON ----------------
const diagnoseBtn = document.getElementById('diagnose-btn');
if (diagnoseBtn) diagnoseBtn.addEventListener('click', diagnoseSymptoms);

// ---------------- GENDER ----------------
let selectedGender = localStorage.getItem('gender') || null;

const genderButtons = {
  male: document.querySelector('.b1'),
  female: document.querySelector('.b2'),
  other: document.querySelector('.b3')
};

function setGender(g) {
  selectedGender = g;
  localStorage.setItem('gender', g ?? '');

  Object.values(genderButtons).forEach(b => b?.classList.remove('active'));
  if (g === 'male') genderButtons.male?.classList.add('active');
  if (g === 'female') genderButtons.female?.classList.add('active');
  if (g === null) genderButtons.other?.classList.add('active');
}

genderButtons.male?.addEventListener('click', () => setGender('male'));
genderButtons.female?.addEventListener('click', () => setGender('female'));
genderButtons.other?.addEventListener('click', () => setGender(null));

setGender(selectedGender);
