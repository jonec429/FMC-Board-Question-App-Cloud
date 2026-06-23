const fs = require('fs');
const lines = fs.readFileSync('questions.csv', 'utf8').split('\n');
const m = {};
let dups = 0;
lines.forEach(l => {
  if (l.startsWith('2025,')) {
    // csv format: Year,ABFM Category,Question,Correct Index,Explanation,Resource Link,Opt A...
    // Resource link is the 5th comma (0-indexed 5) if no commas in text... but text has quotes
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    let parts = [];
    let match;
    while (match = regex.exec(l)) {
      parts.push(match[1] || match[2]);
    }
    const rl = parts[5];
    const qId = parts[13];
    if (rl) {
       if (m[rl]) {
           console.log('Dup:', qId, 'and', m[rl]);
           dups++;
       } else {
           m[rl] = qId;
       }
    }
  }
});
console.log('Dups:', dups);
