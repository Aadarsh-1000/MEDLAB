const selector = document.getElementById('symptoms');
symArray = [['fever', 'cough', 'sore throat', 'runny nose', 'headache', 'myalgia', 'fatigue', 'shortness of breath', 'chest pain', 'abdominal pain', 'nausea', 'vomiting', 'diarrhoea', 'dysuria', 'frequency', 'rash', 'joint pain', 'anosmia', 'loss of taste', 'photophobia', 'rigors', 'night sweats', 'wheeze', 'flank pain', 'back pain', 'dizziness', 'syncope', 'hematuria', 'jaundice', 'weight loss']]
for (let i=0; i<symArray[0].length; i++) {
    let option = document.createElement('option');
    option.textContent = symArray[0][i];
    option.id = symArray[0][i];
    selector.appendChild(option);
}