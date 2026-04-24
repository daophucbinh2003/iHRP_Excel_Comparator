import XLSX from 'xlsx';

const filePath = '/Users/p1ece/Phát triễn ứng dụng/iHRP_Excel_Comparator/Test_Sandbox/BANG_QUYET_TOAN_THUE_TNCN_LUY_KE_THANG_20260424092002.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get headers with header: 1
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('--- Analysis of sheet:', sheetName, '---');
    console.log('Total rows found:', jsonData.length);
    
    if (jsonData.length > 0) {
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
            console.log(`Row ${i}:`, JSON.stringify(jsonData[i]));
        }
    }

    // Header detection logic
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i];
        if (!row) continue;
        const nonNullCount = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
        if (nonNullCount > 5) {
            headerRowIdx = i;
            break;
        }
    }
    
    console.log('Detected header row index:', headerRowIdx);
    if (headerRowIdx !== -1) {
        console.log('Detected headers:', JSON.stringify(jsonData[headerRowIdx]));
    }

} catch (err) {
    console.error('Error analyzing Excel file:', err);
}
