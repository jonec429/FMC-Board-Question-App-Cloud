const fs = require('fs');
const lines = fs.readFileSync('questions.csv', 'utf8').split('\n');
let missingE = 0;
lines.forEach(l => {
  if (l.match(/^202/)) {
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    let parts = [];
    let match;
    while (match = regex.exec(l)) {
      parts.push(match[1] !== undefined ? match[1] : match[2]);
    }
    // parts[6]=Opt A, parts[7]=Opt B, parts[8]=Opt C, parts[9]=Opt D, parts[10]=Opt E
    if (!parts[10] || parts[10].trim() === '') {
        missingE++;
    }
  }
});
console.log('Questions missing Option E in original CSV:', missingE);
