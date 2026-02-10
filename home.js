const selector = document.getElementById('symptoms');
const symArray = [['fever', 'cough', 'sore throat', 'runny nose', 'headache', 'myalgia', 'fatigue', 'shortness of breath', 'chest pain', 'abdominal pain', 'nausea', 'vomiting', 'diarrhoea', 'dysuria', 'frequency', 'rash', 'joint pain', 'anosmia', 'loss of taste', 'photophobia', 'rigors', 'night sweats', 'wheeze', 'flank pain', 'back pain', 'dizziness', 'syncope', 'hematuria', 'jaundice', 'weight loss']]
let symps = [];

// Age slider / input handling
let selectedAge = null;
const slider = document.getElementById('slider');
const ageInput = document.getElementById('age-input');
const syncAgeFrom = v => {
    const n = Number(v) || 0;
    selectedAge = n;
    if (slider && Number(slider.value) !== n) slider.value = n;
    if (ageInput && Number(ageInput.value) !== n) ageInput.value = n;
};
if (slider) {
    syncAgeFrom(slider.value);
    slider.addEventListener('input', e => syncAgeFrom(e.target.value));
}
if (ageInput) {
    syncAgeFrom(ageInput.value);
    ageInput.addEventListener('input', e => {
        let v = e.target.value;
        if (v === '') return;
        v = Math.max(Number(ageInput.min || 0), Math.min(Number(ageInput.max || 100), Number(v)));
        syncAgeFrom(v);
    });
}

for (let i = 0; i < symArray[0].length; i++) {
    let option = document.createElement('option');
    option.textContent = symArray[0][i];
    option.id = symArray[0][i];
    selector.appendChild(option);
}

selector.addEventListener('change', function () {
    const display = document.getElementsByClassName('symbox')
    const selSym = selector.value;
    if (selSym) {
        let selSym1 = document.createElement('div');
        selSym1.classList.add('symptoms');
        selSym1.textContent = selSym;
        selSym1.id = selSym;
        symps.push(selSym);
        let seen = new Set();
        let removedCount = 0;
        for (let i = symps.length; i >= 0; i--) {
            if (seen.has(symps[i])) {
                symps.splice(i-1, 1);
                removedCount++;
                const removed = document.getElementById(symps[i]);
                if (removed) {
                    removed.remove();
                    console.log(symps)
                }
            } else {
                seen.add(symps[i]);
            }
        }
        if (removedCount > 0) {
            alert('Same symptom cannot be placed twice.');
        }
        if (display.length > 0) {
            exist = display[0].querySelectorAll('.symptoms').length;
            if (exist < 10) {
                display[0].appendChild(selSym1);
            }
            else {
                window.alert('Can only upload upto 10 symptoms.');
            }
        }
    }
});

// Diagnose: send selected symptoms to backend
async function diagnoseSymptoms() {
    if (symps.length === 0) {
        alert('Please select at least one symptom');
        return;
    }

    try {
        const payload = { symptoms: symps };
        if (selectedAge !== null) payload.age = selectedAge;
        const res = await fetch('/api/diagnose', {
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

function displayDiagnosisResults(data) {
    const container = document.getElementById('diagnosis-results');
    if (!container) return;
    container.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = `Found ${data.matches.length} possible condition(s)`;
    container.appendChild(title);

    // show age if present in response
    if (data.age !== undefined && data.age !== null) {
        const ageEl = document.createElement('p');
        ageEl.innerHTML = `<strong>Age:</strong> ${data.age}`;
        container.appendChild(ageEl);
    }

    if (data.matches.length === 0) {
        container.appendChild(document.createElement('p')).textContent = 'No matches found.';
        return;
    }

    data.matches.forEach(match => {
        const el = document.createElement('div');
        el.className = 'result-item';
        const defText = match.definition && (match.definition.text || match.definition || '') ;
        el.innerHTML = `
            <h3>${match.name}</h3>
            <p><strong>ID:</strong> ${match.id}</p>
            <p><strong>Matched Symptoms:</strong> ${match.matchedSymptoms}</p>
            <p><strong>Definition:</strong> ${defText}</p>
        `;
        container.appendChild(el);
    });
}

// wire up diagnose button
const diagnoseBtn = document.getElementById('diagnose-btn');
if (diagnoseBtn) diagnoseBtn.addEventListener('click', diagnoseSymptoms);

