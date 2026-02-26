const fs = require('fs');
let buffer = fs.readFileSync('src/index.css');
let text = buffer.toString('utf8');
let cleanText = text.replace(/\x00/g, ''); // strip null bytes
fs.writeFileSync('src/index.css', cleanText);
console.log('Cleaned null bytes');
