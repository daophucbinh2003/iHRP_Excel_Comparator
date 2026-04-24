import XLSX from 'xlsx';

const filePath = '/Users/p1ece/Phát triễn ứng dụng/iHRP_Excel_Comparator/Test_Sandbox/export.xls';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('--- Analysis of formula file:', filePath, '---');
    console.log('Total formulas:', jsonData.length);
    
    const searchTarget = 'PIT.TT_TongThuNhapKhôngChiuThue';
    const found = jsonData.find(row => {
        return Object.values(row).some(val => String(val).includes(searchTarget));
    });
    
    if (found) {
        console.log('Found target formula row:', JSON.stringify(found));
    } else {
        console.log('Target formula NOT found in file.');
        // Show first 5 formulas to see naming convention
        console.log('First 5 formulas:', JSON.stringify(jsonData.slice(0, 5)));
    }

} catch (err) {
    console.error('Error analyzing Excel file:', err);
}
