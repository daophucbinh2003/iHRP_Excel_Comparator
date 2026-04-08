// Hàm xử lý chuẩn hóa dữ liệu cấp cao
export const parseNumSafe = (str) => {
    if (str === null || str === undefined) return 0;
    let s = String(str).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (s === '' || s === '-') return 0; 
    let isNegative = false;
    if (s.startsWith('(') && s.endsWith(')')) { isNegative = true; s = s.slice(1, -1).trim(); }
    else if (s.startsWith('-')) { isNegative = true; s = s.slice(1).trim(); }
    const commaCount = (s.match(/,/g) || []).length;
    const dotCount = (s.match(/\./g) || []).length;
    if (commaCount > 0 && dotCount > 0) {
        s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (commaCount > 1) { s = s.replace(/,/g, ''); }
    else if (commaCount === 1) { s = s.replace(',', '.'); }
    else if (dotCount > 1) { s = s.replace(/\./g, ''); }
    s = s.replace(/\s+/g, '');
    if (s !== '' && !isNaN(s)) return isNegative ? -parseFloat(s) : parseFloat(s);
    return null; // Trả null khi không parse được số, tránh nhầm với 0
};