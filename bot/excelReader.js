const path = require('path');
const xlsx = require('xlsx');
const { cleanDigits, mergeAddressFields } = require('./helpers');

function normalizeString(value = '') {
  return String(value || '').trim();
}

function firstDefined(row, keys = []) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function readSuppliersFromExcel(filePath = path.join(__dirname, 'data', 'funcionarios.xlsx')) {
  const workbook = xlsx.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

  return rows.map((row, index) => {
    const name = normalizeString(firstDefined(row, ['nome', 'Nome', 'NOME', 'razao_social', 'Razão Social']));
    const cpf = cleanDigits(firstDefined(row, ['cpf', 'CPF', 'documento']));
    const phone = normalizeString(firstDefined(row, ['celular', 'Celular', 'telefone', 'Telefone']));
    const email = normalizeString(firstDefined(row, ['email', 'Email', 'E-mail']));

    const addressRaw = normalizeString(firstDefined(row, ['endereco_completo', 'endereço completo', 'address', 'Endereco']));

    const parsedAddress = mergeAddressFields({
      cep: normalizeString(firstDefined(row, ['cep', 'CEP'])),
      street: normalizeString(firstDefined(row, ['endereco', 'Endereço', 'logradouro'])),
      number: normalizeString(firstDefined(row, ['numero', 'Número'])),
      neighborhood: normalizeString(firstDefined(row, ['bairro', 'Bairro'])),
      addressRaw,
    });

    return {
      rowIndex: index + 2,
      name,
      cpf,
      phone,
      email,
      ...parsedAddress,
      city: 'São Paulo',
      state: 'SP',
    };
  });
}

module.exports = {
  readSuppliersFromExcel,
};
