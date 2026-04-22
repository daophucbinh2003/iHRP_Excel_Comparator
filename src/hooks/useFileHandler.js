import { useState } from 'react';
import * as XLSX from 'xlsx';
import { isSTT } from '../utils/excelUtils';

// --- LOGIC QUÉT HEADER TỐI ƯU ---
const getSheetHeaderInfo = (wb, sheetName) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return { headers: [], headerRowIdx: 0 };
    const range = XLSX.utils.decode_range(sheet['!ref']);

    let headerRowIdx = -1;
    const maxScanRow = Math.min(range.e.r, range.s.r + 20);
    let bestRowIdx = range.s.r;

    // Ưu tiên 1: Tìm dòng chứa "Mã Nhân Viên" hoặc "Mã NV"
    for (let R = range.s.r; R <= maxScanRow; ++R) {
        let hasKeyWord = false;
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })];
            if (cell && cell.v !== undefined && cell.v !== null) {
                const text = String(cell.v).trim().toLowerCase();
                if (text.includes('mã') && (text.includes('nhân viên') || text.includes('nv'))) {
                    hasKeyWord = true; break;
                }
            }
        }
        if (hasKeyWord) { headerRowIdx = R; break; }
    }

    // Ưu tiên 2: Tìm dòng chứa "STT"
    if (headerRowIdx === -1) {
        for (let R = range.s.r; R <= maxScanRow; ++R) {
            let hasSTT = false;
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })];
                if (cell && cell.v !== undefined && cell.v !== null) {
                    const text = String(cell.v).trim().toLowerCase();
                    if (text === 'stt' || text === 'số thứ tự' || text === 'so thu tu') {
                        hasSTT = true; break;
                    }
                }
            }
            if (hasSTT) { headerRowIdx = R; break; }
        }
    }

    // Fallback: Dòng có nhiều ô dữ liệu nhất
    if (headerRowIdx === -1) {
        let maxCols = 0;
        for (let R = range.s.r; R <= maxScanRow; ++R) {
            let colCount = 0;
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })];
                if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') colCount++;
            }
            if (colCount > maxCols) { maxCols = colCount; bestRowIdx = R; }
        }
        headerRowIdx = bestRowIdx;
    }

    const headers = [];
    const seen = {};
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({ c: C, r: headerRowIdx })];
        if (cell && cell.v !== undefined && cell.v !== null) {
            const text = String(cell.v).trim();
            if (text !== '') {
                if (seen[text]) {
                    seen[text]++;
                    headers.push(`${text} (${seen[text]})`);
                } else {
                    seen[text] = 1;
                    headers.push(text);
                }
            }
        }
    }
    return { headers, headerRowIdx };
};

const processExcelFile = async (file) => {
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellFormula: true });
        const sheetName = workbook.SheetNames[0];
        const { headers, headerRowIdx } = getSheetHeaderInfo(workbook, sheetName);
        return { name: file.name, customName: file.name, wb: workbook, sheet: sheetName, headers, headerRowIdx };
    } catch (err) {
        alert(`Không thể đọc file "${file.name}".\nVui lòng kiểm tra lại định dạng file (.xlsx hoặc .xls).\n\nChi tiết lỗi: ${err.message}`);
        return null;
    }
};

export function useFileHandler() {
    const [baseFile, setBaseFile] = useState(null);
    const [targetFiles, setTargetFiles] = useState([]);

    // --- Helpers tránh duplicate logic ---

    const _processAndSetBase = async (file) => {
        if (!file) return;
        const processed = await processExcelFile(file);
        if (processed) setBaseFile(processed);
    };

    const _processAndAddTargets = async (files) => {
        if (!files.length) return;
        const newTargets = [];
        for (const file of files) {
            const processed = await processExcelFile(file);
            if (!processed) continue;
            processed.id = Date.now() + Math.random();
            newTargets.push(processed);
        }
        if (newTargets.length > 0) setTargetFiles(prev => [...prev, ...newTargets]);
    };

    // --- Public Handlers ---

    const handleBaseUpload = async (e) => {
        await _processAndSetBase(e.target.files[0]);
        e.target.value = null;
    };

    const handleBaseDrop = async (e) => {
        await _processAndSetBase(e.dataTransfer.files[0]);
    };

    const handleTargetUpload = async (e) => {
        await _processAndAddTargets(Array.from(e.target.files));
        e.target.value = null;
    };

    const handleTargetDrop = async (e) => {
        await _processAndAddTargets(Array.from(e.dataTransfer.files));
    };

    const removeTargetFile = (id) => {
        setTargetFiles(prev => prev.filter(f => f.id !== id));
    };

    const updateTargetName = (id, newName) => {
        setTargetFiles(prev => prev.map(f => f.id === id ? { ...f, customName: newName } : f));
    };

    const updateSheetSelection = (type, newSheet, targetId = null) => {
        if (type === 'base' && baseFile) {
            const { headers, headerRowIdx } = getSheetHeaderInfo(baseFile.wb, newSheet);
            setBaseFile({ ...baseFile, sheet: newSheet, headers, headerRowIdx });
        } else if (type === 'target') {
            setTargetFiles(prev => prev.map(f => {
                if (f.id === targetId) {
                    const { headers, headerRowIdx } = getSheetHeaderInfo(f.wb, newSheet);
                    return { ...f, sheet: newSheet, headers, headerRowIdx };
                }
                return f;
            }));
        }
    };

    return {
        baseFile, setBaseFile, targetFiles,
        handleBaseUpload, handleBaseDrop,
        handleTargetUpload, handleTargetDrop,
        removeTargetFile, updateTargetName, updateSheetSelection,
    };
}