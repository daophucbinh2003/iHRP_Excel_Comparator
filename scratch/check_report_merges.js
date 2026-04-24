import XLSX from 'xlsx';

const filePath = '/Users/p1ece/Phát triễn ứng dụng/iHRP_Excel_Comparator/Test_Sandbox/BANG_QUYET_TOAN_THUE_TNCN_LUY_KE_THANG_20260424092002.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const merges = worksheet['!merges'] || [];
    
    console.log('--- Merges in report file ---');
    merges.slice(0, 20).forEach(m => {
        console.log(`Merge: ${XLSX.utils.encode_range(m)} (Rows ${m.s.r}-${m.e.r}, Cols ${m.s.c}-${m.e.c})`);
    });

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('\n--- Row 4 contents (Raw) ---');
    console.log(JSON.stringify(jsonData[3])); // 0-indexed, Row 4 is index 3
    console.log('\n--- Row 5 contents (Raw) ---');
    console.log(JSON.stringify(jsonData[4]));
    console.log('\n--- Row 6 contents (Raw) ---');
    console.log(JSON.stringify(jsonData[5]));

} catch (err) {
    console.error('Error:', err);
}
