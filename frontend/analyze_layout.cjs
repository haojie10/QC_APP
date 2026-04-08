const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('d:/我的APP/QC APP/frontend/netlify/functions/assets/template.xlsx');
  const worksheet = workbook.getWorksheet(1);

  console.log('--- Scanning for Image Placeholder Regions ---');
  
  const mergedRegions = new Set();
  
  for (let r = 1; r <= 60; r++) {
    for (let c = 1; c <= 9; c++) {
      const cell = worksheet.getCell(r, c);
      if (cell.isMerged && !mergedRegions.has(cell.master.address)) {
        const master = cell.master;
        // Check if it's a large merge (more than 2 cells)
        // This is a heuristic for image areas
        mergedRegions.add(master.address);
        
        // Find label above or inside
        let label = master.value || '';
        if (!label) {
          const aboveValue = worksheet.getCell(r - 1, c).value;
          if (aboveValue) label = `(Above: ${aboveValue})`;
        }
        
        console.log(`Region starting at ${master.address}: Label="${label}"`);
      } else if (!cell.isMerged && cell.value) {
        console.log(`Cell ${cell.address}: Value="${cell.value}"`);
      }
    }
  }
}

analyze().catch(err => console.error(err));
