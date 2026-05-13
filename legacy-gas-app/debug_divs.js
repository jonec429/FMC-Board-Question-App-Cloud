const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = (line.match(/<div\b[^>]*>/g) || []).length;
    const close = (line.match(/<\/div>/g) || []).length;
    const self = (line.match(/<div\b[^>]*\/>/g) || []).length;
    
    const delta = (open - self) - close;
    if (delta !== 0) {
        balance += delta;
        console.log(`Line ${i + 1}: Delta ${delta > 0 ? '+' : ''}${delta}, Running Balance ${balance} | ${line.trim().substring(0, 50)}`);
    }
}
