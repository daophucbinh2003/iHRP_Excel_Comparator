import React, { useState, useEffect, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import CompareWorker from '../utils/compareWorker?worker';
import { parseNumSafe } from '../utils/formatters';
import { isSTT } from '../utils/excelUtils';

export function useComparisonResults(
    baseFile,
    targetFiles,
    keyCol,
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
        return valCols.filter(col => col !== keyCol && !isSTT(col));
    }, [valCols, keyCol]);

    const runMultiComparison = () => {
        if (!keyCol || getCompareColumns.length === 0) {
            alert("Vui lòng chọn cột KEY và đảm bảo bảng có ít nhất 1 cột dữ liệu hợp lệ để đối soát!");
            return;
        }

        setIsProcessing(true);
        setProcessingMsg('Khởi tạo tiến trình đối soát...');
        setResults(null);
        diffNavTracker.current = {};
        setSelectedEmpIdForTest('');
        setExcelFilters({}); // Reset bộ lọc cột từ lần chạy trước
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
                        setCurrentStep(4); // Navigate to results step
                        setIsProcessing(false);
                        setProcessingMsg('');
                        worker.terminate(); // Đóng Worker giải phóng RAM
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
                    keyCol,
                    compareColumns: getCompareColumns, // Use the memoized compare columns
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
                const rowString = JSON.stringify(row).toLowerCase();
                if (!rowString.includes(globalSearchText.toLowerCase())) return false;
            }

            // Logic lọc từng cột (sử dụng Set để đạt O(1))
            for (const cKey in filterSets) {
                const allowedSet = filterSets[cKey];
                let rowVals = [];
                if (cKey === `V_${keyCol}`) {
                    rowVals = [String(row[keyCol])];
                } else if (cKey === 'V_status') {
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
    }, [results, globalFilter, globalSearchText, excelFilters, targetFiles, activeValCols, keyCol]); // Added keyCol as dependency for rowMatchesCurrentView

    const getUniqueValues = (cKey) => {
        if (uniqueValuesCache[cKey]) return uniqueValuesCache[cKey];
        if (!results) return [];
        
        // Fallback nếu cache chưa kịp nạp (hiếm khi xảy ra)
        const vals = new Set();
        results.forEach(r => {
            if (cKey === `V_${keyCol}`) {
                vals.add(String(r[keyCol]));
            } else if (cKey === 'V_status') {
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
    };

    // TỐI ƯU HÓA: Chỉ tính toán lại thống kê tổng quan khi mảng results thay đổi
    const overviewStats = useMemo(() => {
        let dynamicDiffCount = 0;
        let dynamicMatchCount = 0;
        let missingCount = 0;

        if (results) {
            results.forEach(row => {
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
        return results ? { total: results.length, match: dynamicDiffCount, diff: dynamicDiffCount, missing: missingCount } : { total: 0, match: 0, diff: 0, missing: 0 };
    }, [results, activeValCols, targetFiles]);

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

    const getColDiffCount = (colKey) => {
        if (!filteredResults) return 0;
        let count = 0;
        filteredResults.forEach(row => {
            const isDiff = targetFiles.some(tf => row.diffCells[`${colKey}_${tf.id}`]);
            if (isDiff && !row.isMissing) count++;
        });
        return count;
    };

    const handleExportExcel = async () => {
        if (!filteredResults || filteredResults.length === 0) {
            alert("Không có dữ liệu để xuất!");
            return;
        }

        setIsProcessing(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Báo Cáo Đối Soát", {
                views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] // Đóng băng 2 cột đầu, 2 dòng đầu
            });

            // 1. TẠO HEADER ĐA TẦNG VÀ GỘP Ô
            const headerRow1 = [keyCol, 'Trạng Thái Kết Quả'];
            const headerRow2 = ['', ''];
            const merges = [];
            let colIndex = 3; // Cột số 3 trong ExcelJS

            activeValCols.forEach(col => { // Use activeValCols here
                headerRow1.push(col);
                headerRow2.push('GỐC');
                targetFiles.forEach(tf => {
                    headerRow1.push(''); // Ô trống để tí nữa gộp lại
                    headerRow2.push(tf.customName || tf.name);
                });

                const startMerge = colIndex;
                const endMerge = colIndex + targetFiles.length;
                merges.push([1, startMerge, 1, endMerge]);
                colIndex = endMerge + 1;
            });

            worksheet.addRow(headerRow1);
            worksheet.addRow(headerRow2);

            worksheet.mergeCells('A1:A2');
            worksheet.mergeCells('B1:B2');
            merges.forEach(m => worksheet.mergeCells(m[0], m[1], m[2], m[3]));

            // 2. STYLE CHO HEADER (MÀU XANH, CHỮ TRẮNG, KẺ KHUNG)
            for (let i = 1; i <= 2; i++) {
                worksheet.getRow(i).eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            }

            // 3. ĐIỀN DỮ LIỆU & TỰ ĐỘNG BÔI ĐỎ Ô SAI LỆCH
            filteredResults.forEach(row => {
                const rowData = [
                    row[keyCol],
                    row.status.length > 0 ? row.status.join(', ') : (row.isDiff ? 'Có sai lệch' : 'Khớp 100%')
                ];

                activeValCols.forEach(col => { // Use activeValCols here
                    rowData.push(row.baseVals[col] !== undefined ? row.baseVals[col] : '-');
                    targetFiles.forEach(tf => {
                        const tVal = row.targetVals[tf.id]?.[col];
                        rowData.push(tVal !== undefined ? tVal : '-');
                    });
                });

                const addedRow = worksheet.addRow(rowData);

                // Kẻ khung và set style cơ bản cho toàn bộ ô trong dòng
                addedRow.eachCell((cell, colNumber) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { vertical: 'middle', wrapText: true };

                    // Tô màu chữ đỏ cho cột Trạng thái nếu có lỗi
                    if (colNumber === 2 && row.isDiff) cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                });

                // Quét các cột Target xem ô nào bị lệch so với gốc thì tô nền đỏ
                let colTrack = 2;
                activeValCols.forEach(col => { // Use activeValCols here
                    colTrack++; // Nhảy qua cột GỐC
                    targetFiles.forEach(tf => {
                        colTrack++; // Di chuyển sang cột Target
                        if (row.diffCells[`${col}_${tf.id}`]) {
                            const errorCell = addedRow.getCell(colTrack);
                            errorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Nền đỏ nhạt
                            errorCell.font = { color: { argb: 'FF9C0006' }, bold: true }; // Chữ đỏ đậm
                        } else if (row.targetVals[tf.id]?.[col] === ' Bỏ qua/Thiếu') {
                            const skipCell = addedRow.getCell(colTrack);
                            skipCell.font = { color: { argb: 'FF999999' }, italic: true }; // Chữ xám in nghiêng
                        }
                    });
                });
            });

            // 4. TỰ ĐỘNG CĂN CHỈNH BỀ RỘNG CỘT
            worksheet.columns.forEach(column => {
                let maxLen = 10;
                column.eachCell({ includeEmpty: true }, cell => {
                    if (cell.value) {
                        const len = cell.value.toString().length;
                        if (len > maxLen) maxLen = len;
                    }
                });
                column.width = Math.min(maxLen + 2, 45); // Set tối đa 45 để cột không bị kéo ra quá dài
            });

            // 5. XUẤT RA TRÌNH DUYỆT
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `iHRP_Bao_Cao_Doi_Soat_${new Date().getTime()}.xlsx`);

            setToastMessage(`Đã xuất báo cáo chi tiết ${filteredResults.length} dòng thành công!`);
            // setTimeout(() => setToastMessage(''), 3000); // setToastMessage is handled by App.jsx
        } catch (err) {
            console.error(err);
            alert("Lỗi xuất file Excel: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

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
                diffRowIds.push(row[keyCol]);
            }
        });

        if (diffRowIds.length === 0) return;

        const navKey = `V_${colKey}`;
        let currentIndex = diffNavTracker.current[navKey] !== undefined ? diffNavTracker.current[navKey] : -1;

        currentIndex = (currentIndex + 1) % diffRowIds.length;
        diffNavTracker.current[navKey] = currentIndex;

        const targetId = diffRowIds[currentIndex];

        const targetIndexInFiltered = filteredResults.findIndex(r => r[keyCol] === targetId);
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

        const textArea = document.createElement("textarea");
        textArea.value = str;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setToastMessage(`Đã copy: ${str}`);
            // setTimeout(() => setToastMessage(''), 2000); // setToastMessage is handled by App.jsx
        } catch (err) { console.error('Copy failed', err); }
        document.body.removeChild(textArea);
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
                {row.baseVals[keyCol] && (
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
        setShowColMenu(!showColMenu);
    };

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
        handleExportExcel,
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
    };
}