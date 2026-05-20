import XLSX from 'xlsx';
import fs from 'fs';

const fptData = fs.readFileSync('/Users/p1ece/Phát triễn ứng dụng/iHRP_Excel_Comparator/Requirements/FPT.xlsx');
const fptWb = XLSX.read(fptData, { type: 'buffer' });
const sheetName = fptWb.SheetNames[0];
const sheet = fptWb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const headers = rows[1];
const row = rows[4189]; // row 4189 is employee 00167

console.log('Values for employee 00167:');
headers.forEach((h, c) => {
    const val = row[c];
    if (val !== undefined && val !== null && val !== '') {
        console.log(`Col ${c} - ${h}: ${val}`);
    }
});
