import fs from 'fs';
fetch('http://localhost:5173/api/lessons', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test Lesson ' + Date.now(),
    level: 'N5',
    cards: Array.from({length: 500}).map((_, i) => ({
      japanese: 'kanji' + i,
      english: 'english' + i,
      reading: 'reading' + i
    }))
  })
}).then(r => r.json()).then(console.log).catch(console.error);
