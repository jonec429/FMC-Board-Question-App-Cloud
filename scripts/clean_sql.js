const fs = require('fs');

function cleanSQL(filename) {
    let text = fs.readFileSync(filename, 'utf8');
    
    // Replace weird PDF artifacts
    text = text.replace(/\?"/g, '-');
    text = text.replace(/%/g, '≥');
    text = text.replace(/AC/g, '°C');
    text = text.replace(/AF/g, '°F');
    text = text.replace(/\uFFFD/g, ''); // Remove any lingering replacement chars
    
    fs.writeFileSync(filename, text);
}

cleanSQL('data/ITEs/migration_full.sql');
cleanSQL('data/ITEs/migration_test.sql');
console.log('Cleaned SQL files.');
