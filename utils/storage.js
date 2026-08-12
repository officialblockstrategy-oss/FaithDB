const fs = require('fs');

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function loadJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to parse JSON at ${filePath}. Using fallback value.`, error);
    return fallback;
  }
}

function saveJson(filePath, value) {
  ensureFolder(require('path').dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function loadMap(filePath, validate, transform = (value) => value) {
  const data = loadJson(filePath, {});
  const map = new Map();
  for (const [key, value] of Object.entries(data)) {
    try {
      if (validate(value, key)) {
        map.set(key, transform(value, key));
      }
    } catch (error) {
      console.warn(`Skipping invalid data at ${key} in ${filePath}:`, error);
    }
  }
  return map;
}

function saveMap(filePath, map) {
  try {
    saveJson(filePath, Object.fromEntries(map));
  } catch (error) {
    console.error(`Failed to save ${filePath}:`, error);
  }
}

// Utility for loading and saving JSON-backed data files with graceful fallback.

module.exports = {
  ensureFolder,
  loadJson,
  saveJson,
  loadMap,
  saveMap,
};
