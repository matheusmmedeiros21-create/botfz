const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'logs');
const SCREENSHOTS_DIR = path.join(LOGS_DIR, 'screenshots');

function ensureDirectories() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const successFile = path.join(LOGS_DIR, 'success.txt');
  const errorFile = path.join(LOGS_DIR, 'errors.txt');

  if (!fs.existsSync(successFile)) fs.writeFileSync(successFile, '');
  if (!fs.existsSync(errorFile)) fs.writeFileSync(errorFile, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanPause(min = 250, max = 900) {
  await sleep(randomBetween(min, max));
}

function cleanDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function formatCPF(value = '') {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length !== 11) return digits;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCEP(value = '') {
  const digits = cleanDigits(value).slice(0, 8);
  if (digits.length !== 8) return digits;
  return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
}

function formatPhone(value = '') {
  const digits = cleanDigits(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return String(value || '').trim();
}

function parseCombinedAddress(rawAddress = '') {
  const source = String(rawAddress || '').trim().replace(/\s+/g, ' ');
  const result = { cep: '', street: '', number: '', neighborhood: '' };
  if (!source) return result;

  const cepMatch = source.match(/\b\d{5}-?\d{3}\b/);
  let remainder = source;

  if (cepMatch) {
    result.cep = formatCEP(cepMatch[0]);
    remainder = source.replace(cepMatch[0], '').trim();
  }

  const numberMatch = remainder.match(/\b(\d{1,6})\b/);
  if (numberMatch) {
    result.number = numberMatch[1];
    const idx = remainder.indexOf(numberMatch[0]);
    result.street = remainder.slice(0, idx).trim();
    result.neighborhood = remainder.slice(idx + numberMatch[0].length).trim();
  } else {
    result.street = remainder;
  }

  return result;
}

function mergeAddressFields(row) {
  const combined = parseCombinedAddress(row.addressRaw);
  return {
    cep: formatCEP(row.cep || combined.cep),
    street: row.street || combined.street,
    number: String(row.number || combined.number || '').trim(),
    neighborhood: row.neighborhood || combined.neighborhood,
  };
}

function appendLog(filePath, message) {
  fs.appendFileSync(filePath, `${new Date().toISOString()} | ${message}\n`, 'utf-8');
}

function logSuccess(message) {
  appendLog(path.join(LOGS_DIR, 'success.txt'), message);
}

function logError(message) {
  appendLog(path.join(LOGS_DIR, 'errors.txt'), message);
}

async function typeLikeHuman(locator, value, delay = 45) {
  await locator.click({ clickCount: 3 });
  await locator.fill('');
  await locator.type(String(value || ''), { delay });
}

async function smoothScrollWithin(containerLocator, pixels = 450, steps = 8) {
  await containerLocator.evaluate(
    async (el, { px, st }) => {
      const increment = px / st;
      for (let i = 0; i < st; i += 1) {
        el.scrollBy(0, increment);
        await new Promise((resolve) => setTimeout(resolve, 70));
      }
    },
    { px: pixels, st: steps },
  );
}

module.exports = {
  LOGS_DIR,
  SCREENSHOTS_DIR,
  ensureDirectories,
  sleep,
  humanPause,
  cleanDigits,
  formatCPF,
  formatCEP,
  formatPhone,
  parseCombinedAddress,
  mergeAddressFields,
  logSuccess,
  logError,
  typeLikeHuman,
  smoothScrollWithin,
};
