// src/utils/excelUtils.js
export const isSTT = (colName) => {
    if (!colName) return false;
    const lower = String(colName).toLowerCase().trim();
    return lower === 'stt' || lower === 'số thứ tự' || lower === 'so thu tu';
};