const fs = require('fs');

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function loadJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw ? JSON.parse(raw) : fallback;
}

function saveJson(filePath, value) {
  ensureFolder(require('path').dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

module.exports = {
  ensureFolder,
  loadJson,
  saveJson,
};
