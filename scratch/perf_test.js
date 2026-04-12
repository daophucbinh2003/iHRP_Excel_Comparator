const XLSX = require('xlsx');

// Mock a sheet with 10k rows and 20 columns
const rows = 10000;
const cols = 20;
const data = [];
for (let i = 0; i < rows; i++) {
    const row = {};
    for (let j = 0; j < cols; j++) {
        row[`Col${j}`] = `Value_${i}_${j}`;
    }
    data.push(row);
}

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

console.time('sheet_to_json');
const json = XLSX.utils.sheet_to_json(ws);
console.timeEnd('sheet_to_json');

console.time('manual_iteration');
const range = XLSX.utils.decode_range(ws['!ref']);
const headers = [];
for (let j = 0; j < cols; j++) headers[j] = `Col${j}`;

const manualData = [];
for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({r, c});
        const cell = ws[addr];
        if (cell) row[headers[c]] = cell.v;
    }
    manualData.push(row);
}
console.timeEnd('manual_iteration');
