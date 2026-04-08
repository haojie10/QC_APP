import ExcelJS from 'exceljs';
import path from 'path';

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), 'netlify/functions/assets/template.xlsx');
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.getWorksheet(1);
  
  console.log('Sheet:', worksheet.name);
  console.log('Dimensions:', worksheet.dimensions);
  
  const data = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData = { row: rowNumber, height: row.height, cells: [] };
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const cellData = {
        address: cell.address,
        value: cell.value,
        master: cell.master.address,
        isMerged: cell.address !== cell.master.address
      };
      rowData.cells.push(cellData);
    });
    data.push(rowData);
  });

  console.log(JSON.stringify(data, null, 2));
}

analyze().catch(console.error);
