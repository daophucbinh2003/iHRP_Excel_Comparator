import { useState } from 'react';
import * as XLSX from 'xlsx';
import { isSTT } from '../utils/excelUtils';

// --- LOGIC QUÉT HEADER ĐA TẦNG (hỗ trợ merge ngang/dọc phức tạp) ---
const getSheetHeaderInfo = (wb, sheetName) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return { headers: [], headerRowIdx: 0 };

    const merges = sheet['!merges'] || [];

    // Đọc toàn bộ sheet dưới dạng mảng 2D (XLSX đã expand merged cells)
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!jsonData.length) return { headers: [], headerRowIdx: 0 };

    // Helper: merge "toàn bảng" (tiêu đề trang — width >= 10 trên 1 hàng)
    const isFullWidthMerge = (m) => (m.e.c - m.s.c + 1) >= 10 && m.e.r === m.s.r;

    // Tìm merge thực sự của ô (r,c) — bỏ qua merge tiêu đề trang
    const findRealMerge = (r, c) =>
        merges.find(m =>
            !isFullWidthMerge(m) &&
            r >= m.s.r && r <= m.e.r &&
            c >= m.s.c && c <= m.e.c
        );

    // Lấy giá trị của ô từ jsonData (đã expand merge)
    const getCellVal = (r, c) => {
        const v = jsonData[r] ? jsonData[r][c] : null;
        return v !== null && v !== undefined ? String(v).trim() : '';
    };

    const maxScan = Math.min(jsonData.length, 30);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Tìm INDEX ROW (chuỗi số nguyên liên tiếp BẮT ĐẦU từ 1, ≥ 5)
    // Điều kiện chặt: phải bắt đầu chính xác từ giá trị = 1.
    // Tránh nhầm dòng chứa 22,23,24... ở giữa bảng.
    // ═══════════════════════════════════════════════════════════════════════
    let indexRowIdx = -1;
    for (let i = 0; i < maxScan; i++) {
        const row = jsonData[i];
        if (!row) continue;

        const numericCells = row
            .map((cell, ci) => ({ ci, val: cell }))
            .filter(({ val }) => {
                if (val === null || val === undefined || val === '') return false;
                const n = Number(val);
                return Number.isInteger(n) && n > 0;
            })
            .map(({ ci, val }) => ({ ci, val: Number(val) }));

        if (numericCells.length < 5) continue;

        let found = false;
        for (let k = 0; k < numericCells.length; k++) {
            if (numericCells[k].val === 1) {
                let seqLen = 1;
                for (let m = k + 1; m < numericCells.length; m++) {
                    if (numericCells[m].val === seqLen + 1) seqLen++;
                    else break;
                }
                if (seqLen >= 5) { found = true; break; }
            }
        }
        if (found) { indexRowIdx = i; break; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Tìm TRUE HEADER ROW bằng cách quét TẤT CẢ các dòng 0..maxScan
    // KHÔNG phụ thuộc vào vị trí index row (giải quyết trường hợp header
    // nằm SAU index row như BLT1.xlsx).
    // Dùng keywords để nhận diện dòng header: 'stt', 'tt', 'mã nhân viên'...
    // ═══════════════════════════════════════════════════════════════════════
    const HEADER_KEYWORDS = [
        'stt', 'tt', 'no.', 'no',
        'mã nhân viên', 'mã số nv', 'mã nv', 'mã hợp đồng', 'mã kết hợp', 'mã hnv',
        'họ tên', 'họ và tên', 'tên nhân viên', 'full name', 'fullname',
        'employee id', 'emp id', 'empid',
        'department', 'bộ phận',
    ];

    // Tìm TẤT CẢ các dòng có chứa keyword header trong 8 cột đầu
    const headerCandidates = [];
    for (let i = 0; i < maxScan; i++) {
        const row = jsonData[i];
        if (!row) continue;
        const hasMarker = row.slice(0, 8).some(cell => {
            const v = String(cell ?? '').trim().toLowerCase();
            return HEADER_KEYWORDS.some(kw => v === kw);
        });
        if (hasMarker) headerCandidates.push(i);
    }

    let headerStartIdx = -1;
    let effectiveHeaderEnd = -1;

    if (headerCandidates.length > 0) {
        // Lấy nhóm header liên tiếp cuối cùng (xử lý header đa tầng liên tiếp)
        // Ví dụ: rows [4,5] là multi-level header → start=4, end=5
        headerStartIdx = headerCandidates[0];
        effectiveHeaderEnd = headerCandidates[headerCandidates.length - 1];
    } else {
        // Fallback: không tìm được keyword → dùng dòng có nhiều cell text nhất
        // (loại bỏ các dòng chỉ có số hoặc trống)
        let maxTextCount = 0;
        for (let i = 0; i < maxScan; i++) {
            const row = jsonData[i];
            if (!row) continue;
            // Đếm ô có nội dung text (không phải số nguyên, không rỗng)
            const textCount = row.filter(x => {
                if (x === null || x === undefined || String(x).trim() === '') return false;
                const n = Number(x);
                return isNaN(n) || !Number.isInteger(n); // coi là text nếu không phải số nguyên
            }).length;
            if (textCount > maxTextCount) {
                maxTextCount = textCount;
                headerStartIdx = i;
                effectiveHeaderEnd = i;
            }
        }
        if (headerStartIdx === -1) { headerStartIdx = 0; effectiveHeaderEnd = 0; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Xác định headerRowIdx (dòng cuối metadata, data bắt đầu sau đây)
    // = max(effectiveHeaderEnd, indexRowIdx) để data luôn bắt đầu SAU CẢ
    //   header row và index row, bất kể thứ tự nào trong file.
    // ═══════════════════════════════════════════════════════════════════════
    const headerRowIdx = Math.max(
        effectiveHeaderEnd,
        indexRowIdx !== -1 ? indexRowIdx : effectiveHeaderEnd
    );

    // Step 3: Xây dựng headers từ vùng header đa tầng
    const refRow = jsonData[indexRowIdx] || jsonData[effectiveHeaderEnd];
    const numCols = refRow ? refRow.length : 0;
    const headers = [];
    const seen = {};

    for (let c = 0; c < numCols; c++) {
        let leafVal = '';
        let groupFallback = '';

        // Duyệt từ dòng cuối header lên đầu
        for (let r = effectiveHeaderEnd; r >= headerStartIdx; r--) {
            const val = getCellVal(r, c);
            if (!val || val === 'null') continue;

            // Kiểm tra có phải giá trị bị "inherit" từ merge NGANG của cột khác không
            const m = findRealMerge(r, c);
            if (m && m.s.c !== c) {
                // Đây là tên nhóm (merge ngang từ cột khác) → lưu fallback
                if (!groupFallback) groupFallback = val;
                continue;
            }
            // Tên cột thực sự
            leafVal = val;
            break;
        }

        const colName = (leafVal || groupFallback || '').trim();
        if (!colName) {
            headers.push('');
            continue;
        }

        // Xử lý tên trùng lặp
        if (seen[colName]) {
            seen[colName]++;
            headers.push(`${colName} (${seen[colName]})`);
        } else {
            seen[colName] = 1;
            headers.push(colName);
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
        return { name: file.name, customName: file.name, wb: workbook, rawBuffer: data, sheet: sheetName, headers, headerRowIdx };
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