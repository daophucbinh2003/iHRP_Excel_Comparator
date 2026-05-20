import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import CompareWorker from '../utils/compareWorker?worker';
import { parseNumSafe } from '../utils/formatters';
import { isSTT } from '../utils/excelUtils';

export function useComparisonResults(
    baseFile,
    targetFiles,
    keyCols,
    valCols,
    columnMappings,
    customFormulas,
    advancedRules,
    themeUI, // Passed for rendering logic in renderStackedCell
    targetColorsLight, // Passed for rendering logic in renderStackedCell
    targetColorsDark, // Passed for rendering logic in renderStackedCell
    setCurrentStep, // To navigate to step 4
    setToastMessage, // To show toast messages
    selectedEmpIdForTest,
    setSelectedEmpIdForTest
) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMsg, setProcessingMsg] = useState('');
    const [results, setResults] = useState(null);
    const [uniqueValuesCache, setUniqueValuesCache] = useState({});

    // Filter States
    const [globalFilter, setGlobalFilter] = useState('all');
    const [globalSearchText, setGlobalSearchText] = useState('');
    const [excelFilters, setExcelFilters] = useState({});

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 50;

    // Column Visibility States
    const [displayCols, setDisplayCols] = useState([]);
    const [showColMenu, setShowColMenu] = useState(false);
    const colMenuRef = useRef(null);
    const [colDisplaySearch, setColDisplaySearch] = useState('');
    const [colMenuStyle, setColMenuStyle] = useState({});

    // Diff Navigation Tracker
    const diffNavTracker = useRef({});

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [globalFilter, excelFilters, globalSearchText]);

    // Initialize displayCols with baseFile headers
    useEffect(() => {
        if (baseFile && baseFile.headers) {
            setDisplayCols([...baseFile.headers]);
        }
    }, [baseFile]);

    // Helper to get columns that are actually compared (excluding key and STT)
    const getCompareColumns = useMemo(() => {
        if (!Array.isArray(valCols)) return [];
        return valCols.filter(col => !keyCols.includes(col) && !isSTT(col));
    }, [valCols, keyCols]);

    const runMultiComparison = () => {
        if (!keyCols || keyCols.length === 0 || getCompareColumns.length === 0) {
            alert("Vui lòng chọn cột KEY và đảm bảo bảng có ít nhất 1 cột dữ liệu hợp lệ để đối soát!");
            return;
        }

        // Lưu lại danh sách cột đang hiển thị trước khi chạy lại
        // để khôi phục sau khi so sánh hoàn tất (tránh reset cột người dùng đã chọn)
        const savedDisplayCols = displayCols.length > 0 ? [...displayCols] : null;

        // Lưu lại bộ lọc hàng và trạng thái filter tổng trước khi chạy lại
        // để khôi phục đúng ngữ cảnh người dùng đang xem khi áp dụng cấu hình nâng cao
        const savedExcelFilters = { ...excelFilters };
        const savedGlobalFilter = globalFilter;

        setIsProcessing(true);
        setProcessingMsg('Khởi tạo tiến trình đối soát...');
        setResults(null);
        diffNavTracker.current = {};
        setSelectedEmpIdForTest('');
        setExcelFilters({}); // Reset bộ lọc hàng từ lần chạy trước
        setGlobalFilter('all'); // Reset filter tổng về mặc định

        setTimeout(() => {
            try {
                const worker = new CompareWorker();

                worker.onmessage = (e) => {
                    if (e.data.type === 'progress') {
                        setProcessingMsg(e.data.message);
                    } else if (e.data.type === 'success') {
                        setResults(e.data.results);
                        setUniqueValuesCache(e.data.uniqueValuesCache || {});
                        setCurrentStep(4);
                        setIsProcessing(false);
                        setProcessingMsg('');
                        // Khôi phục danh sách cột hiển thị mà người dùng đã thiết lập
                        if (savedDisplayCols) setDisplayCols(savedDisplayCols);
                        // Khôi phục bộ lọc hàng và trạng thái filter tổng
                        setExcelFilters(savedExcelFilters);
                        setGlobalFilter(savedGlobalFilter);
                        worker.terminate();
                    } else if (e.data.type === 'error') {
                        alert("Lỗi tiến trình ngầm: " + e.data.message);
                        setIsProcessing(false);
                        setProcessingMsg('');
                        worker.terminate();
                    }
                };

                // Đẩy dữ liệu sang luồng Worker
                worker.postMessage({
                    baseFile: { wb: baseFile.wb, sheet: baseFile.sheet, headers: baseFile.headers, headerRowIdx: baseFile.headerRowIdx },
                    targetFiles: targetFiles.map(tf => ({ wb: tf.wb, sheet: tf.sheet, headers: tf.headers, headerRowIdx: tf.headerRowIdx, id: tf.id, customName: tf.customName, name: tf.name })),
                    columnMappings,
                    keyCols,
                    compareColumns: getCompareColumns,
                    customFormulas,
                    advancedRules
                });
            } catch (err) {
                console.error(err);
                alert("Không thể khởi tạo Web Worker: " + err.message);
                setIsProcessing(false);
                setProcessingMsg('');
            }
        }, 200);
    };


    const activeValCols = useMemo(() => valCols.filter(c => displayCols.includes(c)), [valCols, displayCols]);

    // TỐI ƯU HÓA: Chỉ tính toán lại danh sách đã lọc khi bộ lọc hoặc dữ liệu gốc thay đổi
    const filteredResults = useMemo(() => {
        if (!results) return [];
        
        // Tạo Set cho các bộ lọc để kiểm tra tồn tại O(1)
        const filterSets = {};
        for (const [cKey, allowedVals] of Object.entries(excelFilters)) {
            if (allowedVals && allowedVals.length > 0) {
                filterSets[cKey] = new Set(allowedVals);
            }
        }

        return results.filter(row => {
            // Logic lọc Global
            if (globalFilter === 'missing' && !row.isMissing) return false;
            
            let hasVisibleDiff = false;
            if (!row.isMissing) {
                for (const col of activeValCols) {
                    if (targetFiles.some(tf => row.diffCells[`${col}_${tf.id}`])) {
                        hasVisibleDiff = true;
                        break;
                    }
                }
            }

            if (globalFilter === 'diff') {
                if (row.isMissing || !hasVisibleDiff) return false;
            } else if (globalFilter === 'match') {
                if (row.isMissing || hasVisibleDiff) return false;
            }

            if (globalSearchText) {
                // Tối ưu: tìm trực tiếp trong các trường có nghĩa, tránh JSON.stringify tốn kém
                const q = globalSearchText.toLowerCase();
                const found =
                    String(row._compositeKey).toLowerCase().includes(q) ||
                    row.status.some(s => String(s).toLowerCase().includes(q)) ||
                    Object.values(row.baseVals).some(v => String(v).toLowerCase().includes(q)) ||
                    Object.values(row.targetVals).some(tfVals =>
                        tfVals && !tfVals._error &&
                        Object.values(tfVals).some(v => String(v).toLowerCase().includes(q))
                    );
                if (!found) return false;
            }

            // Logic lọc từng cột (sử dụng Set để đạt O(1))
            for (const cKey in filterSets) {
                const allowedSet = filterSets[cKey];
                let rowVals = [];
                if (cKey === 'V_status') {
                    rowVals = row.status.map(s => String(s));
                } else {
                    const actualCol = cKey.substring(2);
                    const bVal = row.baseVals[actualCol];
                    if (bVal !== undefined) rowVals.push(String(bVal));

                    targetFiles.forEach(tf => {
                        const tVal = row.targetVals[tf.id]?.[actualCol];
                        if (tVal !== undefined && tVal !== ' Bỏ qua/Thiếu') rowVals.push(String(tVal));
                    });
                }

                if (!rowVals.some(v => allowedSet.has(String(v)))) return false;
            }

            return true;
        });
    }, [results, globalFilter, globalSearchText, excelFilters, targetFiles, activeValCols, keyCols]);

    const getUniqueValues = useCallback((cKey) => {
        if (!results) return [];

        // FAST PATH: không có filter nào khác và không search → dùng cache từ Worker (O(1))
        const hasOtherActiveFilters = Object.entries(excelFilters)
            .some(([k, v]) => k !== cKey && v && v.length > 0);
        if (!hasOtherActiveFilters && !globalSearchText && globalFilter === 'all') {
            return uniqueValuesCache[cKey] || [];
        }

        // SLOW PATH: có filter khác đang active → tính cascade (bỏ qua self-filter)
        const filterSetsWithoutSelf = {};
        for (const [k, allowedVals] of Object.entries(excelFilters)) {
            if (k !== cKey && allowedVals && allowedVals.length > 0) {
                filterSetsWithoutSelf[k] = new Set(allowedVals);
            }
        }

        const q = globalSearchText ? globalSearchText.toLowerCase() : '';

        const rowsInScope = results.filter(row => {
            if (globalFilter === 'missing' && !row.isMissing) return false;
            let hasVisibleDiff = false;
            if (!row.isMissing) {
                for (const col of activeValCols) {
                    if (targetFiles.some(tf => row.diffCells[`${col}_${tf.id}`])) {
                        hasVisibleDiff = true; break;
                    }
                }
            }
            if (globalFilter === 'diff' && (row.isMissing || !hasVisibleDiff)) return false;
            if (globalFilter === 'match' && (row.isMissing || hasVisibleDiff)) return false;

            if (q) {
                const found =
                    String(row._compositeKey).toLowerCase().includes(q) ||
                    row.status.some(s => String(s).toLowerCase().includes(q)) ||
                    Object.values(row.baseVals).some(v => String(v).toLowerCase().includes(q)) ||
                    Object.values(row.targetVals).some(tfVals =>
                        tfVals && !tfVals._error &&
                        Object.values(tfVals).some(v => String(v).toLowerCase().includes(q))
                    );
                if (!found) return false;
            }

            for (const k in filterSetsWithoutSelf) {
                const allowedSet = filterSetsWithoutSelf[k];
                let rowVals = [];
                if (k === 'V_status') {
                    rowVals = row.status.map(s => String(s));
                } else {
                    const actualCol = k.substring(2);
                    const bVal = row.baseVals[actualCol];
                    if (bVal !== undefined) rowVals.push(String(bVal));
                    targetFiles.forEach(tf => {
                        const tVal = row.targetVals[tf.id]?.[actualCol];
                        if (tVal !== undefined && tVal !== ' Bỏ qua/Thiếu') rowVals.push(String(tVal));
                    });
                }
                if (!rowVals.some(v => allowedSet.has(String(v)))) return false;
            }
            return true;
        });

        const vals = new Set();
        rowsInScope.forEach(r => {
            if (cKey === 'V_status') {
                r.status.forEach(s => vals.add(s));
            } else {
                const actualCol = cKey.substring(2);
                const bVal = r.baseVals[actualCol];
                if (bVal !== undefined) vals.add(String(bVal));
                targetFiles.forEach(tf => {
                    const tVal = r.targetVals[tf.id]?.[actualCol];
                    if (tVal !== undefined && tVal !== ' Bỏ qua/Thiếu') vals.add(String(tVal));
                });
            }
        });
        return Array.from(vals).sort((a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true }));
    }, [results, excelFilters, globalFilter, globalSearchText, uniqueValuesCache, activeValCols, targetFiles, keyCols]);

    // TỐI ƯU HÓA: Chỉ tính toán lại thống kê tổng quan khi mảng results thay đổi
    const overviewStats = useMemo(() => {
        let dynamicDiffCount = 0;
        let dynamicMatchCount = 0;
        let missingCount = 0;

        if (filteredResults) {
            filteredResults.forEach(row => {
                if (row.isMissing) {
                    missingCount++;
                    return;
                }
                let hasVisibleDiff = false;
                for (const col of activeValCols) {
                    if (targetFiles.some(tf => row.diffCells[`${col}_${tf.id}`])) {
                        hasVisibleDiff = true;
                        break;
                    }
                }
                if (hasVisibleDiff) dynamicDiffCount++;
                else dynamicMatchCount++;
            });
        }
        return filteredResults ? { total: filteredResults.length, match: dynamicMatchCount, diff: dynamicDiffCount, missing: missingCount } : { total: 0, match: 0, diff: 0, missing: 0 };
    }, [filteredResults, activeValCols, targetFiles]);

    const displayedValCols = useMemo(() => valCols.filter(c => c.toLowerCase().includes(colDisplaySearch.toLowerCase())), [valCols, colDisplaySearch]);
    const isAllValDisplayed = useMemo(() => displayedValCols.length > 0 && displayedValCols.every(c => displayCols.includes(c)), [displayedValCols, displayCols]);

    const toggleAllDisplayVal = (checked) => {
        if (checked) {
            const newDisplay = new Set([...displayCols, ...displayedValCols]);
            setDisplayCols(Array.from(newDisplay));
        } else {
            setDisplayCols(displayCols.filter(c => !displayedValCols.includes(c)));
        }
    };

    // TỐI ƯU: tính toán 1 lần cho tất cả cột, thay vì N lần mỗi render (O(rows×cols) → O(1) per call)
    const colDiffCountMap = useMemo(() => {
        const map = {};
        if (!filteredResults) return map;
        for (const col of activeValCols) { map[col] = 0; }
        for (const row of filteredResults) {
            if (row.isMissing) continue;
            for (const col of activeValCols) {
                if (targetFiles.some(tf => row.diffCells[`${col}_${tf.id}`])) {
                    map[col]++;
                }
            }
        }
        return map;
    }, [filteredResults, activeValCols, targetFiles]);

    const getColDiffCount = useCallback((colKey) => colDiffCountMap[colKey] || 0, [colDiffCountMap]);

    // ─────────────────────────────────────────────────────────────────────
    // XUẤT LƯỚI DỮ LIỆU — Template cũ, 1 sheet, chỉ dữ liệu đang hiển thị
    // (theo bộ lọc hàng + cột đang bật trên lưới)
    // ─────────────────────────────────────────────────────────────────────
    const handleExportGrid = async () => {
        if (!filteredResults || filteredResults.length === 0) {
            alert('Không có dữ liệu để xuất!');
            return;
        }

        setIsProcessing(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Đối Soát Dữ Liệu', {
                views: [{ state: 'frozen', xSplit: keyCols.length + 1, ySplit: 2 }],
            });

            const borderThin = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' },
            };

            // ── Header Row 1: tên cột (gộp ô theo cụm)
            const headerRow1 = [...keyCols, 'Trạng Thái'];
            const headerRow2 = [...keyCols.map(() => ''), ''];
            const merges = [];
            let colIndex = keyCols.length + 2;

            activeValCols.forEach(col => {
                headerRow1.push(col);
                headerRow2.push(baseFile?.customName || baseFile?.name || 'Gốc');
                targetFiles.forEach(tf => {
                    headerRow1.push('');
                    headerRow2.push(tf.customName || tf.name);
                });
                const endMerge = colIndex + targetFiles.length;
                merges.push([1, colIndex, 1, endMerge]);
                colIndex = endMerge + 1;
            });

            worksheet.addRow(headerRow1);
            worksheet.addRow(headerRow2);
            for (let i = 1; i <= keyCols.length + 1; i++) {
                worksheet.mergeCells(1, i, 2, i);
            }
            merges.forEach(m => worksheet.mergeCells(m[0], m[1], m[2], m[3]));

            for (let i = 1; i <= 2; i++) {
                worksheet.getRow(i).eachCell(cell => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.border = borderThin;
                });
            }

            // ── Dữ liệu: chỉ filteredResults + activeValCols (theo lưới hiện tại)
            filteredResults.forEach(row => {
                const rowData = [
                    ...keyCols.map(k => row.baseVals[k] !== undefined ? row.baseVals[k] : (targetFiles[0] && row.targetVals[targetFiles[0].id]?.[k] !== undefined ? row.targetVals[targetFiles[0].id][k] : '-')),
                    row.status.length > 0 ? row.status.join(', ') : (row.isDiff ? 'Có sai lệch' : 'Khớp 100%'),
                ];
                activeValCols.forEach(col => {
                    rowData.push(row.baseVals[col] !== undefined ? row.baseVals[col] : '-');
                    targetFiles.forEach(tf => {
                        const tVal = row.targetVals[tf.id]?.[col];
                        rowData.push(tVal !== undefined ? tVal : '-');
                    });
                });

                const addedRow = worksheet.addRow(rowData);
                addedRow.eachCell((cell, colNumber) => {
                    cell.border = borderThin;
                    cell.alignment = { vertical: 'middle', wrapText: true };
                    if (colNumber === keyCols.length + 1 && row.isDiff) {
                        cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                    }
                });

                let colTrack = keyCols.length + 1;
                activeValCols.forEach(col => {
                    colTrack++; // cột GỐC
                    targetFiles.forEach(tf => {
                        colTrack++;
                        if (row.diffCells[`${col}_${tf.id}`]) {
                            const c = addedRow.getCell(colTrack);
                            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                            c.font = { color: { argb: 'FF9C0006' }, bold: true };
                        } else if (row.targetVals[tf.id]?.[col] === ' Bỏ qua/Thiếu') {
                            addedRow.getCell(colTrack).font = { color: { argb: 'FF999999' }, italic: true };
                        }
                    });
                });
            });

            // ── Auto-width
            worksheet.columns.forEach(col => {
                let maxLen = 10;
                col.eachCell({ includeEmpty: true }, cell => {
                    if (cell.value) {
                        const l = String(cell.value).length;
                        if (l > maxLen) maxLen = l;
                    }
                });
                col.width = Math.min(maxLen + 2, 45);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `iHRP_Doi_Soat_Luoi_${new Date().getTime()}.xlsx`);
            setToastMessage(`Đã xuất lưới dữ liệu — ${filteredResults.length} dòng, ${activeValCols.length} cột đang hiển thị.`);
        } catch (err) {
            console.error(err);
            alert('Lỗi xuất file Excel: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // XUẤT BÁO CÁO — Template giống file mẫu MOVI (nhiều sheet)
    // ─────────────────────────────────────────────────────────────────────
    const handleExportReport = async (customCols = null) => {
        if (!filteredResults || filteredResults.length === 0) {
            alert("Không có dữ liệu để xuất!");
            return;
        }

        setIsProcessing(true);
        try {
            const workbook = new ExcelJS.Workbook();

            // ═══════════════════════════════════════════════════════════════
            // CONSTANTS — màu sắc lấy chính xác từ file mẫu MOVI
            // ═══════════════════════════════════════════════════════════════
            const HDR_DARK       = 'FF1F3864'; // Xanh đậm: header raw sheet
            const HDR_COL_NAME   = 'FF1F3864'; // Xanh đậm: tên cột sheet Chênh lệch
            const HDR_BASE       = 'FFFF0066'; // Hồng đỏ: cột GỐC
            const HDR_TARGET     = 'FFFF9900'; // Cam vàng: cột TARGET
            const HDR_SS         = 'FF808080'; // Xám: cột So Sánh
            const NUM_COLOR_ID   = 'FF4472C4'; // Xanh dương: STT idCols
            const NUM_COLOR_DATA = 'FFFF0066'; // Hồng đỏ: STT data cols
            const DIFF_BG        = 'FFFFC7CE';
            const DIFF_FONT      = 'FF9C0006';
            const MATCH_BG       = 'FFC6EFCE';
            const MISSING_BG     = 'FFFFF2CC';

            const borderThin = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' },
            };

            const applyHeaderStyle = (cell, bgArgb, fontArgb = 'FFFFFFFF') => {
                cell.font      = { bold: true, color: { argb: fontArgb }, size: 10 };
                cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border    = borderThin;
            };

            const applyNumStyle = (cell, fontArgb) => {
                cell.font      = { color: { argb: fontArgb }, size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border    = borderThin;
            };

            const applyDataStyle = (cell) => {
                cell.font      = { size: 10 };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border    = borderThin;
            };

            // ═══════════════════════════════════════════════════════════════
            // copySheetWithDiff
            //   Input: rawBuffer = ArrayBuffer gốc từ file upload (không qua
            //          XLSX.write — chỉ 1 lần parse ExcelJS, tối đa fidelity)
            //   1. ExcelJS load trực tiếp từ rawBuffer
            //   2. Copy y chang toàn bộ sheet (format, style, merge, frozen...)
            //   3. Overlay highlight đỏ lên ô chênh lệch
            // ═══════════════════════════════════════════════════════════════
            const copySheetWithDiff = async (rawBuffer, srcSheetName, destSheetName, fileHeaderRowIdx, isBase, tfId) => {
                if (!rawBuffer) {
                    console.warn(`copySheetWithDiff: rawBuffer missing for sheet ${srcSheetName}`);
                    return;
                }
                // Load trực tiếp từ buffer gốc (không qua XLSX.write!)
                const srcWb   = new ExcelJS.Workbook();
                await srcWb.xlsx.load(rawBuffer);
                const srcWs = srcWb.getWorksheet(srcSheetName);
                if (!srcWs) return;

                // ── Tạo sheet đích ──────────────────────────────────────
                const destWs = workbook.addWorksheet(destSheetName, {
                    views: srcWs.views ?? [],
                    properties: srcWs.properties ?? {},
                });

                // ── Copy chiều rộng cột ──────────────────────────────────
                srcWs.columns.forEach((col, idx) => {
                    const dc = destWs.getColumn(idx + 1);
                    if (col.width)  dc.width  = col.width;
                    if (col.hidden) dc.hidden = col.hidden;
                });

                // ── Build diff lookup: keyColValue → result ──────────────
                const resultByKey = {};
                results.forEach(row => {
                    const k = String(row._compositeKey ?? '').trim();
                    if (k) resultByKey[k] = row;
                });

                // ── Quét header rows → map colName → colNum ──────────────
                // Cần tìm: keyCol + tất cả valCols (hoặc mapped target cols)
                const headerEndRow  = (fileHeaderRowIdx ?? 0) + 1; // 1-based Excel row
                const dataStartRow  = headerEndRow + 1;            // data bắt đầu từ đây
                const colNameToNum  = {};                          // { colName: excelColNum }

                // Mapping base→target col name cho target sheet
                const mapping = (!isBase && tfId && columnMappings?.[tfId]) ? columnMappings[tfId] : {};

                // Set tên cột cần tìm trong header
                const colNamesToFind = new Set([...keyCols]);
                valCols.forEach(baseCol => {
                    colNamesToFind.add(baseCol);
                    if (!isBase) {
                        const targetCol = mapping[baseCol];
                        if (targetCol) colNamesToFind.add(targetCol);
                    }
                });

                // Scan tất cả header rows để tìm vị trí cột
                for (let r = 1; r <= headerEndRow; r++) {
                    const hRow = srcWs.getRow(r);
                    hRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
                        const val = String(cell.value ?? '').trim();
                        if (val && colNamesToFind.has(val) && !colNameToNum[val]) {
                            colNameToNum[val] = colNum;
                        }
                    });
                }

                const keyColNums = keyCols.map(k => colNameToNum[k]).filter(Boolean);
                const hasAllKeyCols = keyColNums.length === keyCols.length;

                // ── Copy từng dòng + apply diff overlay ─────────────────
                srcWs.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
                    const destRow = destWs.getRow(rowNum);
                    if (srcRow.height) destRow.height = srcRow.height;

                    // Copy tất cả cells (value + style)
                    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
                        const destCell = destRow.getCell(colNum);
                        // Ép toàn bộ Formula thành giá trị tĩnh (Static Value) để diệt tận gốc lỗi corrupt XML
                        if (srcCell.type === ExcelJS.ValueType.Formula) {
                            // Chỉ lấy kết quả đã tính toán, bỏ qua chuỗi công thức
                            destCell.value = srcCell.result ?? srcCell.value?.result ?? '';
                        } else {
                            destCell.value = srcCell.value;
                        }
                        try {
                            if (srcCell.style && Object.keys(srcCell.style).length) {
                                destCell.style = JSON.parse(JSON.stringify(srcCell.style));
                            }
                        } catch (_) {}
                    });

                    // Chỉ apply diff cho data rows (sau header)
                    if (rowNum >= dataStartRow && hasAllKeyCols) {
                        const keyParts = keyColNums.map(colNum => String(srcRow.getCell(colNum).value ?? '').trim());
                        const keyVal = keyParts.join(' _|_ ');
                        const result = keyVal ? resultByKey[keyVal] : null;

                        if (result && !result.isMissing) {
                            const diffColsBase = customCols || valCols.filter(c => !keyCols.includes(c));

                            diffColsBase.forEach(baseCol => {
                                // Kiểm tra có lệch không?
                                let hasDiff = false;
                                if (isBase) {
                                    hasDiff = targetFiles.some(tf => !!result.diffCells?.[`${baseCol}_${tf.id}`]);
                                } else {
                                    hasDiff = !!result.diffCells?.[`${baseCol}_${tfId}`];
                                }
                                if (!hasDiff) return;

                                // Tìm colNum trong sheet này
                                // Base sheet: colName = baseCol
                                // Target sheet: colName = mapped target col, fallback = baseCol
                                const sheetColName = isBase
                                    ? baseCol
                                    : (mapping[baseCol] || baseCol);
                                const colNum = colNameToNum[sheetColName];
                                if (!colNum) return;

                                const destCell = destRow.getCell(colNum);
                                destCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DIFF_BG } };
                                destCell.font = {
                                    ...(destCell.font || {}),
                                    color: { argb: DIFF_FONT },
                                    bold: true,
                                };
                            });
                        }
                    }

                    destRow.commit();
                });

                // ── Copy merged cells ────────────────────────────────────
                try {
                    const mergeSet = new Set();
                    Object.values(srcWs._merges || {}).forEach(m => {
                        const ref = m?.model?.ref || (typeof m === 'string' ? m : null);
                        if (ref && !mergeSet.has(ref)) {
                            mergeSet.add(ref);
                            try { destWs.mergeCells(ref); } catch (_) {}
                        }
                    });
                } catch (_) {}
            };

            // ── Sheet 1: File gốc (rawBuffer → ExcelJS + diff overlay) ────
            await copySheetWithDiff(
                baseFile.rawBuffer,
                baseFile.sheet,
                baseFile?.customName || baseFile?.name || 'Gốc',
                baseFile.headerRowIdx,
                true,  // isBase
                null,
            );

            // ── Sheet 2..N: mỗi target (rawBuffer → ExcelJS + diff overlay)
            for (const tf of targetFiles) {
                await copySheetWithDiff(
                    tf.rawBuffer,
                    tf.sheet,
                    tf.customName || tf.name || 'Target',
                    tf.headerRowIdx,
                    false,  // isTarget
                    tf.id,
                );
            }


            // ═══════════════════════════════════════════════════════════════
            // Sheet "Chênh lệch" — giống hệt file mẫu MOVI
            // Row 4:  "Lệch" (merge idCols) + diff counts tại cột SS
            // Row 5:  Tên cột (merge theo cụm colsPerField)
            // Row 6:  GỐC(hồng)|TARGET(cam)|So Sánh(xám) — mỗi cụm
            // Row 7:  Spacer — cùng màu row6
            // Row 8:  Số thứ tự
            // Row 9+: Data
            // ═══════════════════════════════════════════════════════════════
            const baseName     = baseFile?.customName || baseFile?.name || 'Gốc';
            const idCols       = ['No.', ...keyCols];
            // Dùng TOÀN BỘ valCols (hoặc cột được chọn)
            const compCols     = customCols || valCols.filter(c => !keyCols.includes(c));
            const colsPerField = 1 + targetFiles.length * 2; // GỐC + (TARGET+SS)×N
            const totalCols    = idCols.length + compCols.length * colsPerField;

            const wsC = workbook.addWorksheet('Chênh lệch', {
                views: [{ state: 'frozen', xSplit: idCols.length, ySplit: 8 }],
            });

            const diffCounts = {};
            compCols.forEach(col => {
                diffCounts[col] = filteredResults.filter(row =>
                    !row.isMissing && targetFiles.some(tf => row.diffCells[`${col}_${tf.id}`])
                ).length;
            });

            // Row 4: "Lệch" + counts ──────────────────────────────────────
            {
                const vals = new Array(totalCols).fill('');
                vals[0] = 'Lệch';
                compCols.forEach((col, ci) => {
                    const fStart = idCols.length + ci * colsPerField;
                    targetFiles.forEach((_, ti) => { vals[fStart + 1 + ti * 2 + 1] = diffCounts[col] || 0; });
                });
                const r4 = wsC.addRow(vals);
                r4.height = 28.5;
                wsC.mergeCells(4, 1, 4, idCols.length);
                const lCell = r4.getCell(1);
                lCell.value     = 'Lệch';
                lCell.font      = { bold: true, color: { argb: DIFF_FONT }, size: 10 };
                lCell.alignment = { vertical: 'middle', horizontal: 'center' };
                lCell.border    = borderThin;
                for (let c = idCols.length + 1; c <= totalCols; c++) {
                    const cell = r4.getCell(c);
                    cell.font      = { size: 10 };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border    = borderThin;
                    if (typeof cell.value === 'number' && cell.value > 0) {
                        cell.font = { bold: true, color: { argb: DIFF_FONT }, size: 10 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DIFF_BG } };
                    }
                }
            }

            // Row 5: Tên cột (merge theo cụm) ─────────────────────────────
            {
                const vals = [...idCols];
                compCols.forEach(col => { vals.push(col); for (let i = 0; i < colsPerField - 1; i++) vals.push(''); });
                const r5 = wsC.addRow(vals);
                r5.height = 21;
                idCols.forEach((_, i) => applyHeaderStyle(r5.getCell(i + 1), HDR_COL_NAME));
                compCols.forEach((_, ci) => {
                    const sc = idCols.length + ci * colsPerField + 1;
                    wsC.mergeCells(5, sc, 5, sc + colsPerField - 1);
                    applyHeaderStyle(r5.getCell(sc), HDR_COL_NAME);
                });
            }

            // Row 6: Sub-header GỐC | TARGET | So Sánh ───────────────────
            {
                const vals = idCols.map(() => '');
                compCols.forEach(() => {
                    vals.push(baseName);
                    targetFiles.forEach(tf => { vals.push(tf.customName || tf.name || 'Target'); vals.push('So Sánh'); });
                });
                const r6 = wsC.addRow(vals);
                r6.height = 27.75;
                idCols.forEach((_, i) => applyHeaderStyle(r6.getCell(i + 1), HDR_COL_NAME));
                compCols.forEach((_, ci) => {
                    const fStart = idCols.length + ci * colsPerField;
                    applyHeaderStyle(r6.getCell(fStart + 1), HDR_BASE, 'FF000000');
                    targetFiles.forEach((_, ti) => {
                        applyHeaderStyle(r6.getCell(fStart + 2 + ti * 2),     HDR_TARGET);
                        applyHeaderStyle(r6.getCell(fStart + 2 + ti * 2 + 1), HDR_SS);
                    });
                });
            }

            // Row 7: Spacer — cùng màu row 6, height 25.5 ─────────────────
            {
                const vals = new Array(totalCols).fill('');
                const r7 = wsC.addRow(vals);
                r7.height = 25.5;
                idCols.forEach((_, i) => applyHeaderStyle(r7.getCell(i + 1), HDR_COL_NAME));
                compCols.forEach((_, ci) => {
                    const fStart = idCols.length + ci * colsPerField;
                    applyHeaderStyle(r7.getCell(fStart + 1), HDR_BASE, 'FF000000');
                    targetFiles.forEach((_, ti) => {
                        applyHeaderStyle(r7.getCell(fStart + 2 + ti * 2),     HDR_TARGET);
                        applyHeaderStyle(r7.getCell(fStart + 2 + ti * 2 + 1), HDR_SS);
                    });
                });
            }

            // Row 8: Số thứ tự (#, 1, 2, ...) ─────────────────────────────
            {
                const vals = ['#', ...idCols.slice(1).map(() => '')];
                compCols.forEach((_, ci) => { vals.push(ci + 1); targetFiles.forEach(() => { vals.push(''); vals.push(''); }); });
                const r8 = wsC.addRow(vals);
                r8.height = 20;
                idCols.forEach((_, i) => applyNumStyle(r8.getCell(i + 1), NUM_COLOR_ID));
                compCols.forEach((_, ci) => {
                    const fStart = idCols.length + ci * colsPerField;
                    applyNumStyle(r8.getCell(fStart + 1), NUM_COLOR_DATA);
                    targetFiles.forEach((_, ti) => {
                        applyNumStyle(r8.getCell(fStart + 2 + ti * 2),     NUM_COLOR_DATA);
                        applyNumStyle(r8.getCell(fStart + 2 + ti * 2 + 1), NUM_COLOR_DATA);
                    });
                });
            }

            // Row 9+: Dữ liệu ─────────────────────────────────────────────
            filteredResults.forEach((row, rowIdx) => {
                const vals = [rowIdx + 1, ...keyCols.map(k => row.baseVals[k] !== undefined ? row.baseVals[k] : (targetFiles[0] && row.targetVals[targetFiles[0].id]?.[k] !== undefined ? row.targetVals[targetFiles[0].id][k] : '-'))];
                compCols.forEach(col => {
                    vals.push(row.isMissing ? '' : (row.baseVals[col] ?? ''));
                    targetFiles.forEach(tf => {
                        const v = row.targetVals[tf.id]?.[col];
                        vals.push((!row.isMissing && v !== undefined && v !== ' Bỏ qua/Thiếu') ? v : '');
                        vals.push('');
                    });
                });

                const dr = wsC.addRow(vals);
                dr.height = 20;
                dr.eachCell(cell => applyDataStyle(cell));

                compCols.forEach((col, ci) => {
                    const fStart = idCols.length + ci * colsPerField;
                    targetFiles.forEach((tf, ti) => {
                        const isDiff   = !row.isMissing && !!row.diffCells[`${col}_${tf.id}`];
                        const tCell    = dr.getCell(fStart + 2 + ti * 2);
                        const ssCell   = dr.getCell(fStart + 2 + ti * 2 + 1);

                        if (isDiff) {
                            tCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: DIFF_BG } };
                            tCell.font   = { color: { argb: DIFF_FONT }, bold: true, size: 10 };
                            ssCell.value = 'Lệch';
                            ssCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: DIFF_BG } };
                            ssCell.font  = { color: { argb: DIFF_FONT }, bold: true, size: 10 };
                            ssCell.alignment = { vertical: 'middle', horizontal: 'center' };
                        } else if (!row.isMissing) {
                            ssCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MATCH_BG } };
                        }
                        if (row.isMissing) {
                            dr.getCell(fStart + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MISSING_BG } };
                        }
                    });
                });
            });

            // Auto-width sheet Chênh lệch
            wsC.columns.forEach(col => {
                let maxLen = 6;
                col.eachCell({ includeEmpty: true }, cell => {
                    if (cell.value) { const l = String(cell.value).length; if (l > maxLen) maxLen = l; }
                });
                col.width = Math.min(maxLen + 2, 40);
            });

            // ── Xuất file ────────────────────────────────────────────────
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `iHRP_Bao_Cao_${new Date().getTime()}.xlsx`);
            const totalSheets = 1 + targetFiles.length + 1;
            setToastMessage(`Đã xuất báo cáo ${totalSheets} sheet (gốc + ${targetFiles.length} target + chênh lệch) — ${filteredResults.length} dòng.`);
        } catch (err) {
            console.error(err);
            alert("Lỗi xuất file Excel: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };


    // PAGINATION LOGIC
    // PAGINATION LOGIC
    const totalPages = Math.ceil(filteredResults.length / rowsPerPage);
    const currentResults = filteredResults.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
    const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
    const handleFirstPage = () => { setCurrentPage(1); };
    const handleLastPage = () => { if (currentPage < totalPages) setCurrentPage(totalPages); }; // Fixed: should be totalPages, not currentPage < totalPages

    const handleBadgeClick = (e, colKey) => {
        e.stopPropagation();

        const diffRowIds = [];
        filteredResults.forEach(row => {
            const isDiff = targetFiles.some(tf => row.diffCells[`${colKey}_${tf.id}`]);
            if (isDiff && !row.isMissing) {
                diffRowIds.push(row._compositeKey);
            }
        });

        if (diffRowIds.length === 0) return;

        const navKey = `V_${colKey}`;
        let currentIndex = diffNavTracker.current[navKey] !== undefined ? diffNavTracker.current[navKey] : -1;

        currentIndex = (currentIndex + 1) % diffRowIds.length;
        diffNavTracker.current[navKey] = currentIndex;

        const targetId = diffRowIds[currentIndex];

        const targetIndexInFiltered = filteredResults.findIndex(r => r._compositeKey === targetId);
        if (targetIndexInFiltered !== -1) {
            const targetPage = Math.floor(targetIndexInFiltered / rowsPerPage) + 1;
            if (currentPage !== targetPage) {
                setCurrentPage(targetPage);
            }

            setTimeout(() => {
                const rowElement = document.getElementById(`row-${targetId}`);
                if (rowElement) {
                    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    rowElement.classList.remove('highlight-row-anim');
                    void rowElement.offsetWidth;
                    rowElement.classList.add('highlight-row-anim');
                }
            }, 300);
        }
    };

    const handleCopy = (text) => {
        if (text === undefined || text === null || text === '-') return;
        const str = String(text);
        if (str.trim() === '') return;

        let fallbackSuccess = false;
        try {
            const textArea = document.createElement("textarea");
            textArea.value = str;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            fallbackSuccess = document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (e) {
            console.error('Fallback copy failed', e);
        }

        if (navigator.clipboard && window.isSecureContext) {
            try {
                navigator.clipboard.writeText(str)
                    .then(() => setToastMessage(`Đã copy: ${str}`))
                    .catch(err => {
                        console.error('Clipboard API failed', err);
                        if (fallbackSuccess) setToastMessage(`Đã copy: ${str}`);
                    });
            } catch (syncErr) {
                console.error('Clipboard API sync error', syncErr);
                if (fallbackSuccess) setToastMessage(`Đã copy: ${str}`);
            }
        } else {
            if (fallbackSuccess) setToastMessage(`Đã copy: ${str}`);
        }
    };

    const renderStackedCell = (row, colKey) => {
        const baseKey = colKey;
        const baseVal = row.baseVals[baseKey];
        const strBaseVal = baseVal !== undefined ? String(baseVal) : '-';
        const hasAnyDiff = targetFiles.some(tf => row.diffCells[`${colKey}_${tf.id}`]);

        // Khi filter = 'diff': ô không có diff hiển thị dấu gạch mờ
        if (!hasAnyDiff && !row.isMissing && globalFilter === 'diff') {
            return <span className={`block w-full text-center font-bold opacity-30 ${themeUI.isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>-</span>;
        }

        // Khi filter = 'all' hoặc 'match' với ô không có diff và không thiếu: hiển thị đơn giản
        if (!hasAnyDiff && !row.isMissing && globalFilter !== 'match') {
            return <span className={`font-medium cursor-pointer break-words whitespace-pre-wrap flex-1 min-w-0 ${themeUI.tdHover} p-0.5 rounded transition-colors inline-block w-full h-full`} onClick={() => handleCopy(strBaseVal)} title="Click để Copy">{strBaseVal}</span>;
        }

        return (
            <div className="flex flex-col gap-1.5 min-w-0 w-full h-full">
                {row._compositeKey && (
                    <div className="flex items-start gap-1.5 w-full">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0 mt-0.5 uppercase tracking-wide max-w-[80px] truncate ${themeUI.isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-gray-200 text-gray-700 border-gray-300'}`} title={baseFile?.customName || 'GỐC'}>
                            {baseFile?.customName || 'GỐC'}
                        </span>
                        <span className={`break-words whitespace-pre-wrap font-medium flex-1 min-w-0 cursor-pointer ${themeUI.tdHover} p-0.5 rounded transition-colors inline-block w-full ${themeUI.isDarkMode ? 'text-gray-200' : 'text-gray-800'}`} onClick={() => handleCopy(strBaseVal)} title="Click để Copy">{strBaseVal}</span>
                    </div>
                )}
                {targetFiles.map((tf, i) => {
                    const tfData = row.targetVals[tf.id];
                    if (!tfData) return null;
                    const isDiff = row.diffCells[`${colKey}_${tf.id}`];
                    const isMissingCol = tfData[baseKey] === ' Bỏ qua/Thiếu';
                    const val = tfData[baseKey];
                    const strVal = val !== undefined ? String(val) : '-';

                    if (!isDiff && !row.isMissing && globalFilter !== 'match') return null;

                    const colorClass = themeUI.isDarkMode ? targetColorsDark[i % targetColorsDark.length] : targetColorsLight[i % targetColorsLight.length];

                    return (
                        <div key={tf.id} className="flex items-start gap-1.5 w-full">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0 truncate max-w-[80px] mt-0.5 uppercase tracking-wide ${colorClass}`} title={tf.customName || tf.name}>
                                {tf.customName || tf.name}
                            </span>
                            <span className={`break-words whitespace-pre-wrap font-medium flex-1 min-w-0 w-full ${isDiff ? (themeUI.isDarkMode ? 'text-red-400 font-bold' : 'text-red-600 font-bold') : (themeUI.isDarkMode ? 'text-gray-400' : 'text-gray-600')} ${isMissingCol ? 'italic opacity-70' : ''}`}>
                                {tfData._error ? <span className="text-red-500 italic text-xs">{tfData._error}</span> : <span className={`cursor-pointer ${themeUI.tdHover} p-0.5 rounded transition-colors inline-block w-full`} onClick={() => handleCopy(strVal)} title="Click để Copy">{strVal}</span>}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleToggleColMenu = () => {
        if (!showColMenu && colMenuRef.current) {
            const rect = colMenuRef.current.getBoundingClientRect();
            const topPos = rect.bottom + 8;
            const rightPos = window.innerWidth - rect.right;
            setColMenuStyle({
                position: 'fixed',
                top: `${topPos}px`,
                right: `${rightPos}px`,
                zIndex: 999999,
            });
        }
        setShowColMenu(prev => !prev);
    };

    // Đóng dropdown "Cột hiển thị" khi click ra ngoài
    useEffect(() => {
        if (!showColMenu) return;
        const handleClickOutside = (e) => {
            if (colMenuRef.current && !colMenuRef.current.contains(e.target)) {
                setShowColMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColMenu]);

    return {
        isProcessing,
        processingMsg,
        results,
        globalFilter,
        setGlobalFilter,
        globalSearchText,
        setGlobalSearchText,
        excelFilters,
        setExcelFilters,
        currentPage,
        setCurrentPage,
        rowsPerPage,
        displayCols,
        setDisplayCols,
        showColMenu,
        setShowColMenu,
        colMenuRef,
        colDisplaySearch,
        setColDisplaySearch,
        colMenuStyle,
        setColMenuStyle,
        selectedEmpIdForTest,
        setSelectedEmpIdForTest,
        runMultiComparison,
        filteredResults,
        overviewStats,
        totalPages,
        currentResults,
        getUniqueValues,
        getColDiffCount,
        handleExportGrid,
        handleExportReport,
        handleNextPage,
        handlePrevPage,
        handleFirstPage,
        handleLastPage,
        handleBadgeClick,
        renderStackedCell,
        handleToggleColMenu,
        toggleAllDisplayVal,
        activeValCols, // Export activeValCols for use in UI
        displayedValCols,
        isAllValDisplayed,
        diffNavTracker,
        handleCopy,
    };
}