require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');
const { readSuppliersFromExcel } = require('./excelReader');
const {
  ensureDirectories,
  SCREENSHOTS_DIR,
  humanPause,
  formatCPF,
  formatCEP,
  formatPhone,
  logSuccess,
  logError,
  typeLikeHuman,
  smoothScrollWithin,
} = require('./helpers');

function askQuestion(promptText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resolveExcelPath() {
  const defaultPath = process.env.EXCEL_PATH || path.join(__dirname, 'data', 'funcionarios.xlsx');
  console.log(`Planilha padrão configurada: ${defaultPath}`);
  const customPath = (await askQuestion('Digite o caminho da planilha Excel (.xlsx) ou pressione ENTER para usar a padrão: ')).trim();

  const chosenPath = customPath || defaultPath;
  const absolutePath = path.isAbsolute(chosenPath) ? chosenPath : path.resolve(process.cwd(), chosenPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Planilha não encontrada: ${absolutePath}`);
  }

  if (!absolutePath.toLowerCase().endsWith('.xlsx')) {
    throw new Error(`Arquivo inválido. Informe um arquivo .xlsx: ${absolutePath}`);
  }

  return absolutePath;
}

async function fillField(modal, label, value) {
  const input = modal.getByLabel(label, { exact: false });
  await input.scrollIntoViewIfNeeded();
  await humanPause(120, 320);
  await typeLikeHuman(input, value || '');
}

async function selectPF(modal) {
  const tipoSelect = modal.getByLabel('Tipo', { exact: false });
  await tipoSelect.scrollIntoViewIfNeeded();
  await tipoSelect.selectOption({ label: 'PF' });
  await humanPause(250, 450);
}

async function selectStateSP(modal) {
  const estadoSelect = modal.getByLabel('Estado', { exact: false });
  await estadoSelect.scrollIntoViewIfNeeded();
  await humanPause(100, 250);
  await estadoSelect.selectOption({ label: 'SP' });
  await humanPause(200, 350);
}

async function hasValidationError(page) {
  const validationPatterns = [
    'CPF já cadastrado',
    'já existe',
    'obrigatório',
    'inválido',
    'erro',
    'duplicado',
  ];

  for (const pattern of validationPatterns) {
    const alert = page.getByText(pattern, { exact: false }).first();
    if (await alert.isVisible().catch(() => false)) {
      return `Validação ERP detectada: ${pattern}`;
    }
  }
  return null;
}

async function createSupplier(page, supplier) {
  const newSupplierButton = page.getByRole('button', { name: /Novo Fornecedor/i });
  await newSupplierButton.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Novo Fornecedor' }).first();
  await modal.waitFor({ state: 'visible', timeout: 20000 });

  await selectPF(modal);
  await fillField(modal, 'Razão Social', supplier.name);
  await fillField(modal, 'Nome Fantasia', supplier.name);
  await fillField(modal, 'CPF', formatCPF(supplier.cpf));

  await fillField(modal, 'Contato Principal', formatPhone(supplier.phone));
  await fillField(modal, 'Telefone', formatPhone(supplier.phone));
  await fillField(modal, 'Email', supplier.email);

  await smoothScrollWithin(modal, 500, 9);

  await fillField(modal, 'CEP', formatCEP(supplier.cep));
  await fillField(modal, 'Endereço', supplier.street);
  await fillField(modal, 'Número', supplier.number);
  await fillField(modal, 'Bairro', supplier.neighborhood);
  await fillField(modal, 'Cidade', 'São Paulo');
  await selectStateSP(modal);

  await humanPause(300, 700);
  await modal.getByRole('button', { name: /^Criar$/i }).click();

  await page.waitForTimeout(1300);

  const validationError = await hasValidationError(page);
  if (validationError) {
    const cancelButton = modal.getByRole('button', { name: /Cancelar/i });
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click().catch(() => {});
    }
    throw new Error(validationError);
  }

  await modal.waitFor({ state: 'hidden', timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(900);
}

(async () => {
  ensureDirectories();

  const excelPath = await resolveExcelPath();
  const suppliers = readSuppliersFromExcel(excelPath);

  if (!suppliers.length) {
    console.log('Nenhum registro encontrado no Excel.');
    return;
  }

  const browser = await chromium.launch({ headless: false, slowMo: Number(process.env.SLOW_MO || 0) });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  console.log('Abra manualmente o ERP e navegue até Financeiro → Fornecedores.');
  await askQuestion('Pressione ENTER para iniciar a automação na página de Fornecedores... ');

  for (const supplier of suppliers) {
    try {
      if (!supplier.name || !supplier.cpf) {
        throw new Error('Dados obrigatórios ausentes: nome ou CPF.');
      }

      await createSupplier(page, supplier);
      logSuccess(`Linha ${supplier.rowIndex} | ${supplier.name} | CPF ${supplier.cpf} | OK`);
      console.log(`✅ Fornecedor criado: ${supplier.name}`);
      await humanPause(350, 950);
    } catch (error) {
      const shotPath = path.join(
        SCREENSHOTS_DIR,
        `row_${supplier.rowIndex}_${Date.now()}.png`,
      );
      await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
      logError(
        `Linha ${supplier.rowIndex} | ${supplier.name || '(sem nome)'} | CPF ${supplier.cpf || '(sem cpf)'} | ERRO: ${error.message} | screenshot: ${shotPath}`,
      );
      console.error(`❌ Falha na linha ${supplier.rowIndex}: ${error.message}`);
      await humanPause(450, 1100);
      continue;
    }
  }

  console.log('Processamento concluído. Verifique logs/success.txt e logs/errors.txt.');
})();
