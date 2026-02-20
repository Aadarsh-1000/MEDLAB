// ---------------- ELEMENTS ----------------
const selector = document.getElementById('symptoms');
const diagnoseBtn = document.getElementById('diagnose-btn');

// ---------------- SYMPTOMS ----------------
const symArray = [
  'fever','cough','sore throat','runny nose','headache','myalgia',
  'fatigue','shortness of breath','chest pain','abdominal pain',
  'nausea','vomiting','diarrhoea','dysuria','frequency','rash',
  'joint pain','anosmia','loss of taste','photophobia','rigors',
  'night sweats','wheeze','flank pain','back pain','dizziness',
  'syncope','hematuria','jaundice','weight loss'
];

let selectedSymptoms = [];

// ---------------- AGE ----------------
let selectedAge = null;
const slider = document.getElementById('slider');
const ageInput = document.getElementById('age-input');

function syncAge(value) {
  selectedAge = Number(value) || null;
  slider && (slider.value = selectedAge ?? 0);
  ageInput && (ageInput.value = selectedAge ?? '');
}

slider?.addEventListener('input', e => syncAge(e.target.value));
ageInput?.addEventListener('input', e => syncAge(e.target.value));

// ---------------- GENDER ----------------
let selectedGender = localStorage.getItem('gender');

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

// ---------------- POPULATE DROPDOWN ----------------
symArray.forEach(sym => {
  const option = document.createElement('option');
  option.value = sym;
  option.textContent = sym;
  selector.appendChild(option);
});

// ---------------- SELECT SYMPTOMS ----------------
selector.addEventListener('change', () => {
  const box = document.querySelector('.symbox');
  const value = selector.value;

  if (!value || selectedSymptoms.includes(value)) return;
  if (selectedSymptoms.length >= 10) {
    alert('Maximum 10 symptoms allowed');
    return;
  }

  selectedSymptoms.push(value);

  const tag = document.createElement('div');
  tag.className = 'symptoms';
  tag.textContent = value;

  box.appendChild(tag);
});

// ---------------- DIAGNOSE (VERCEL SAFE) ----------------
async function diagnoseSymptoms() {
  if (!selectedSymptoms.length) {
    alert('Please select at least one symptom');
    return;
  }

  try {
    const response = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symptoms: selectedSymptoms,
        age: selectedAge,
        gender: selectedGender
      })
    });

    if (!response.ok) throw new Error('API error');

    const result = await response.json();
    displayResults(result);

  } catch (err) {
    console.error(err);
    alert('Diagnosis service unavailable. Please try again.');
  }
}

diagnoseBtn?.addEventListener('click', diagnoseSymptoms);

// ---------------- DISPLAY RESULTS ----------------
function displayResults(data) {
  const container = document.getElementById('diagnosis-results');
  container.innerHTML = '<h2>Top Probable Conditions</h2>';

  if (!data.matches || data.matches.length === 0) {
    container.innerHTML += '<p>No matches found.</p>';
    return;
  }

  data.matches.forEach(m => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <h3>${m.name}</h3>
      <p><strong>Confidence:</strong> ${m.confidence}%</p>
      <p><strong>Matched symptoms:</strong> ${m.matchedSymptoms.join(', ')}</p>
    `;
    container.appendChild(div);
  });
}