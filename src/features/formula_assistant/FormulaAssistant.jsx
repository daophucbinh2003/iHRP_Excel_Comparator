import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';

import { extractVariables } from '../../utils/astCompiler';
import { useThemeContext } from '../../context/ThemeContext';
import { useFormula } from '../../context/FormulaContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { FormulaImportModal } from './FormulaImportModal';
import { normalizeHeader, isSTT, extractCleanName, stringSimilarity } from '../../utils/excelUtils';

export function FormulaAssistant() {
    const { themeUI, isDarkMode } = useThemeContext();
    const { 
        formulaTab, setFormulaTab, 
        newFormulaTarget, setNewFormulaTarget, 
        newFormulaExpr, setNewFormulaExpr, 
        hasPreviewed, setHasPreviewed, 
        previewVariables, setPreviewVariables, 
        editingFormulaIdx, setEditingFormulaIdx, 
        customFormulas, setCustomFormulas, 
        importFormulaRef,
        handlePreviewFormula, 
        testEmpId, setTestEmpId, 
        isEmpComboOpen, setIsEmpComboOpen,
        empSearch, setEmpSearch,
        empComboRef,
        testFormulaIdx, setTestFormulaIdx, 
        isSandboxComboOpen, setIsSandboxComboOpen, 
        sandboxSearch, setSandboxSearch, 
        sandboxComboRef, 
        handleTestFormulaLoad, 
        testEmpFound, setTestEmpFound, 
        testVariables, setTestVariables, 
        showConsole, setShowConsole, 
        handleCalculateSandboxFormula, 
        isCalculated, setIsCalculated, 
        testResult, setTestResult, 
        testTargetVal, setTestTargetVal, 
        calcLogs, setCalcLogs, 
        setGraphViewFormula, setIsGraphOpen, 
        setChainViewFormula, setIsChainOpen, 
        isImportModalOpen, setIsImportModalOpen, 
        importFiles, setImportFiles, 
        formulaSearch, setFormulaSearch,
        selectedIndices, setSelectedIndices,
        sandboxResult, setSandboxResult,
        compareCol, setCompareCol,
        isCompareColComboOpen, setIsCompareColComboOpen,
        compareColSearch, setCompareColSearch,
        compareColComboRef,
        isFromTransferred, setIsFromTransferred,
        results, keyCol, valCols,
        selectedEmpIdForTest, setSelectedEmpIdForTest,
        reportColumns, setReportColumns,
        reportData, setReportData,
        rawFormulaData, setRawFormulaData,
        mappingPreview, setMappingPreview,
        isMappingModalOpen, setIsMappingModalOpen
    } = useFormula();

    useEffect(() => {
        const hasGross = customFormulas.some(f => f.targetCol === 'TT_TongThuNhap_Gross');
        if (!hasGross && customFormulas.length > 0) {
            const grossFormula = { 
                targetCol: 'TT_TongThuNhap_Gross', 
                expression: 'ROUND(HT_ThucLinh_LCD + HT_ThucLinh_LHQ + HT_ThuongHSG + HT_LuongBSTetAm + HT_Thuong3004 + HT_Thuong0106 + HT_Thuong0803 + HT_Thuong2010 + HT_Thuong0209 + HT_LuongBST13 + HT_TetDuongLich + HT_ThuongSNSHB,0) + ROUND(HT_ThueBS_HSG + HT_ThueBS_TetAm + HT_ThueBS_TetDuong  + HT_ThueBS_2707 + HT_ThueBS_LuongT13 + HT_ThueBS_HiemNgheo + HT_ThueBS_TriAnDongGop + HT_ThueBS_TriAnSinhNhatSHB + HT_ThuNhapBS,0)'
                // Không fix cứng mappedCol ở đây
            };
            setCustomFormulas(prev => [...prev, grossFormula]);
        }
    }, [customFormulas, setCustomFormulas]);
    
    // Tự động đồng bộ Cột so sánh khi mapping thay đổi hoặc công thức được chọn
    useEffect(() => {
        if (testFormulaIdx >= 0 && customFormulas[testFormulaIdx]) {
            const f = customFormulas[testFormulaIdx];
            if (reportColumns.length > 0 && f.mappedCol) {
                // Chỉ cập nhật nếu nó đang trống hoặc khác với mapping mới
                if (compareCol !== f.mappedCol) {
                    setCompareCol(f.mappedCol);
                }
            }
        }
    }, [customFormulas, testFormulaIdx, reportColumns, compareCol, setCompareCol]);
    
    const { currentStep, setCurrentStep, setPreviousStep } = useWorkflow();
    
    // Auto-detect employee when ID changes
    React.useEffect(() => {
        if (testEmpId && results && results.length > 0) {
            const empRow = results.find(r => String(r[keyCol]) === String(testEmpId).trim());
            if (empRow) {
                setTestEmpFound(true);
            } else {
                setTestEmpFound(false);
            }
        }
    }, [testEmpId, results, keyCol]);

    // LOGIC IMPORT BÁO CÁO (CHỈ LẤY DỮ LIỆU)
    const processReportFile = async (file) => {
        if (!file) return;
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];

            // Đọc raw dữ liệu (có defval null để phân biệt ô trống)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
            if (!jsonData.length) return;

            const merges = worksheet['!merges'] || [];

            // Helper: kiểm tra merge "toàn bảng" (width >= 10 trên 1 hàng duy nhất → tiêu đề trang)
            const isFullWidthMerge = (m) => (m.e.c - m.s.c + 1) >= 10 && m.e.r === m.s.r;

            // Tìm merge thực sự của ô (r,c) — bỏ qua merge tiêu đề trang
            const findRealMerge = (r, c) =>
                merges.find(m =>
                    !isFullWidthMerge(m) &&
                    r >= m.s.r && r <= m.e.r &&
                    c >= m.s.c && c <= m.e.c
                );

            // Lấy giá trị của ô (r,c) từ jsonData — XLSX.js đã fill giá trị từ merge vào ô đầu tiên
            const getCellVal = (r, c) => {
                const v = jsonData[r] ? jsonData[r][c] : null;
                return v !== null && v !== undefined ? String(v).trim() : '';
            };

            // ---- Step 1: Tìm dòng index (1, 2, 3, ...) ----
            let indexRowIdx = -1;
            for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
                const row = jsonData[i];
                if (!row) continue;
                const firstFive = row.filter(x => x !== null && x !== undefined).slice(0, 5);
                if (firstFive.length < 5) continue;
                const isIndexRow = firstFive.every((cell, idx) => {
                    const v = parseInt(cell);
                    return !isNaN(v) && v === idx + 1;
                });
                if (isIndexRow) { indexRowIdx = i; break; }
            }

            // ---- Step 2: Xác định vùng header ----
            // Header bắt đầu từ dòng đầu tiên có "STT"/"Mã NV"
            // Header kết thúc ở ngay trước indexRowIdx (bao phủ TẤT CẢ dòng header, kể cả sub-header không có STT)
            let headerStartIdx = -1;
            const headerEndIdx = indexRowIdx !== -1 ? indexRowIdx - 1 : -1;
            const searchLimit = indexRowIdx !== -1 ? indexRowIdx : 20;

            for (let i = 0; i < searchLimit; i++) {
                const row = jsonData[i];
                if (!row) continue;
                const hasSTT = row.some(cell => {
                    const v = String(cell ?? '').trim().toLowerCase();
                    return ['stt', 'mã nv', 'manv', 'mã nhân viên'].includes(v);
                });
                if (hasSTT && headerStartIdx === -1) headerStartIdx = i;
            }

            if (headerStartIdx === -1) {
                console.warn('Không tìm được header row');
                return;
            }

            // ---- Step 3: Xây dựng tên cột ----
            // Với mỗi cột c, duyệt từ dòng cuối header lên đầu:
            //   - Nếu ô (r,c) có giá trị VÀ không phải do merge NGANG từ cột khác → đó là tên cột
            //   - Nếu ô (r,c) có giá trị nhưng từ merge NGANG (m.s.c != c) → bỏ qua
            //   - Fallback: lấy giá trị merge NGANG (tên nhóm) nếu không có tên cụ thể
            const refRow = indexRowIdx !== -1 ? jsonData[indexRowIdx] : jsonData[headerEndIdx];
            const numCols = refRow ? refRow.length : 36;
            const finalHeaders = [];

            for (let c = 0; c < numCols; c++) {
                let leafVal = '';
                let groupFallback = '';

                for (let r = headerEndIdx; r >= headerStartIdx; r--) {
                    const val = getCellVal(r, c);
                    if (!val || val === 'null') continue;

                    // Kiểm tra xem giá trị này có phải từ merge NGANG (từ cột khác) không
                    const m = findRealMerge(r, c);
                    if (m && m.s.c !== c) {
                        // Giá trị này là "tên nhóm" (merge ngang từ cột khác)
                        // Lưu làm fallback nhưng tiếp tục tìm tên cụ thể hơn
                        if (!groupFallback) groupFallback = val;
                        continue;
                    }

                    // Đây là tên cột thực sự (không phải merge từ cột khác)
                    leafVal = val;
                    break;
                }

                // Dùng tên cột thực, hoặc fallback về tên nhóm
                finalHeaders[c] = (leafVal || groupFallback || '').trim();
            }

            setReportColumns(finalHeaders);

            // ---- Step 4: Đọc dữ liệu từ sau vùng header ----
            // Nếu có dòng index (1,2,3...) thì data bắt đầu từ dòng ngay sau đó
            // Nếu không có, data bắt đầu từ sau dòng header cuối cùng
            const actualDataStartIdx = indexRowIdx !== -1 ? indexRowIdx + 1 : headerEndIdx + 1;
            
            const filteredData = XLSX.utils.sheet_to_json(worksheet, {
                header: finalHeaders, // Sử dụng headers đã xử lý merge đa tầng làm key
                range: actualDataStartIdx,
                defval: ''
            });

            setReportData(filteredData);

            // Xóa mapping cũ khi nạp báo cáo mới để đảm bảo tính đúng đắn (theo yêu cầu user)
            setCustomFormulas(prev => prev.map(f => ({ ...f, mappedCol: undefined })));
        } catch (err) {
            console.error("Import Report Error:", err);
            alert("Lỗi khi đọc file báo cáo.");
        }
    };

    const handleImportReport = (e) => {
        processReportFile(e.target.files[0]);
        e.target.value = '';
    };

    // LOGIC IMPORT CÔNG THỨC (CHỈ LẤY DỮ LIỆU)
    const processFormulaFile = async (file) => {
        if (!file) return;
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length > 0) {
                setRawFormulaData(jsonData);
            }
        } catch (err) {
            console.error("Import Formula Error:", err);
            alert("Lỗi khi đọc file công thức.");
        }
    };

    const handleImportFormulaMapping = (e) => {
        processFormulaFile(e.target.files[0]);
        e.target.value = '';
    };

    // AUTO-LOAD TEST DATA (REMOVED)
    useEffect(() => {
        // Khởi tạo sạch sẽ
    }, []);

    // LOGIC CHẠY ÁNH XẠ KHI CÓ ĐỦ 2 FILE
    const handleRunMapping = () => {
        if (reportColumns.length === 0 || rawFormulaData.length === 0) {
            alert("Vui lòng nạp cả Báo cáo và File công thức trước.");
            return;
        }

        const mappings = [];
        // Tìm vị trí cột STT
        let sttIdx = reportColumns.findIndex(h => isSTT(h));
        
        if (sttIdx === -1 && reportColumns.length > 0) {
            const firstCol = String(reportColumns[0] || '').trim().toLowerCase();
            if (firstCol === 'stt' || firstCol === 'no' || firstCol === 'no.') {
                sttIdx = 0;
            }
        }

        const relevantCols = sttIdx >= 0 ? reportColumns.slice(sttIdx + 1) : reportColumns;

        relevantCols.forEach((reportCol) => {
            // --- SMART MATCHING LOGIC ---
            // Tìm hàng trong rawFormulaData có tên tương tự nhất với reportCol
            let bestRow = null;
            let maxSim = -1;
            const normReport = normalizeHeader(reportCol);

            rawFormulaData.forEach(row => {
                const colNameKey = Object.keys(row).find(k => {
                    const nk = normalizeHeader(k);
                    return ['têncột', 'tencot', 'columnname', 'target', 'mã'].includes(nk);
                });
                if (!colNameKey) return;
                
                const targetName = String(row[colNameKey] || '').trim();
                const normTarget = normalizeHeader(targetName);
                
                // 1. Khớp tuyệt đối (sau khi normalize)
                if (normTarget === normReport) {
                    maxSim = 1.0;
                    bestRow = row;
                    return;
                }
                
                // 2. Độ tương đồng chuỗi
                const sim = stringSimilarity(normReport, normTarget);
                if (sim > maxSim) {
                    maxSim = sim;
                    bestRow = row;
                }
            });

            // Nếu độ tương đồng đủ cao (ngưỡng 0.6), coi như là khớp
            if (bestRow && maxSim > 0.6) {
                const formulaRow = bestRow;
                const colNameKey = Object.keys(formulaRow).find(k => {
                    const nk = normalizeHeader(k);
                    return ['têncột', 'tencot', 'columnname', 'target', 'mã'].includes(nk);
                });
                const formulaKey = Object.keys(formulaRow).find(k => {
                    const nk = normalizeHeader(k);
                    return ['côngthức', 'congthuc', 'formula', 'sql', 'expression'].includes(nk);
                });
                
                const formulaTargetName = String(formulaRow[colNameKey] || '').trim();
                let formula = String(formulaRow[formulaKey] || '').trim();
                formula = formula.replace(/^[\d\s]+/, '').trim();

                const isExisting = customFormulas.some(f => {
                    const normF = normalizeHeader(extractCleanName(f.targetCol));
                    const normM = normalizeHeader(extractCleanName(formula));
                    return normF === normM || normF.includes(normM) || normM.includes(normF);
                });

                mappings.push({
                    reportCol: reportCol,
                    formulaTargetName: formulaTargetName,
                    formula: formula,
                    status: isExisting ? 'success' : 'missing_config',
                    similarity: maxSim
                });
            } else {
                mappings.push({
                    reportCol: reportCol,
                    formulaTargetName: '--',
                    formula: '--',
                    status: 'missing_formula',
                    similarity: 0
                });
            }
        });

        if (mappings.length === 0) {
            alert("Không tìm thấy dữ liệu cột nào sau STT để ánh xạ.");
        } else {
            setMappingPreview(mappings);
            setIsMappingModalOpen(true);
        }
    };

    // DRAG AND DROP HANDLERS
    const [dragActive, setDragActive] = useState({ report: false, formula: false });

    const handleDrag = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(prev => ({ ...prev, [type]: true }));
        } else if (e.type === "dragleave") {
            setDragActive(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleDrop = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(prev => ({ ...prev, [type]: false }));
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            if (type === 'report') processReportFile(e.dataTransfer.files[0]);
            else processFormulaFile(e.dataTransfer.files[0]);
        }
    };

    const confirmMapping = () => {
        if (!mappingPreview) return;
        
        // Tạo một Map để tra cứu nhanh: normalize(cleanName) -> reportCol
        const mappingMap = new Map();
        mappingPreview.forEach(m => {
            if (m.status !== 'missing_formula') {
                const id = normalizeHeader(extractCleanName(m.formula));
                if (id) mappingMap.set(id, m.reportCol);
            }
        });

        const newFormulas = customFormulas.map(f => {
            const id = normalizeHeader(extractCleanName(f.targetCol));
            if (mappingMap.has(id)) {
                const reportCol = mappingMap.get(id);
                // Tìm thông tin gốc trong preview để cập nhật expression nếu cần
                const m = mappingPreview.find(mp => normalizeHeader(extractCleanName(mp.formula)) === id);
                return { 
                    ...f, 
                    mappedCol: reportCol,
                    expression: (f.expression && f.expression.length > 30) ? f.expression : (m ? m.formula : f.expression)
                };
            }
            return f;
        });

        // Xử lý các công thức mới (không có trong customFormulas)
        mappingPreview.forEach(m => {
            if (m.status === 'missing_formula') return;
            const id = normalizeHeader(extractCleanName(m.formula));
            const isExisting = newFormulas.some(f => normalizeHeader(extractCleanName(f.targetCol)) === id);
            
            if (!isExisting) {
                newFormulas.push({ 
                    targetCol: m.formulaTargetName && m.formulaTargetName !== '--' ? m.formulaTargetName : extractCleanName(m.formula), 
                    expression: m.formula,
                    mappedCol: m.reportCol 
                });
            }
        });

        setCustomFormulas(newFormulas);
        
        // CẬP NHẬT TRỰC TIẾP: Tìm mapping cho công thức đang chọn ngay lập tức
        if (testFormulaIdx >= 0 && customFormulas[testFormulaIdx]) {
            const currentFormula = customFormulas[testFormulaIdx];
            const id = normalizeHeader(extractCleanName(currentFormula.targetCol));
            if (mappingMap.has(id)) {
                setCompareCol(mappingMap.get(id));
            }
        }

        setIsMappingModalOpen(false);
        setMappingPreview(null);
        setFormulaTab('sandbox');
        alert(`Đã hoàn tất ánh xạ và cập nhật công thức.`);
    };

    // LOGIC TRÍCH XUẤT FILE EXCEL TOÀN DIỆN
    const handleStartExtraction = async () => {
        if (importFiles.length === 0) return;
        const allExtracted = [];
        try {
            for (const file of importFiles) {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                jsonData.forEach(row => {
                    const rowKeys = Object.keys(row);
                    const targetKey = rowKeys.find(k => {
                        const nk = String(k).toLowerCase().replace(/\s+/g, '');
                        return ['mã', 'mãtiêuchí', 'target', 'code', 'id'].includes(nk);
                    });
                    const exprKey = rowKeys.find(k => {
                        const nk = String(k).toLowerCase().replace(/\s+/g, '');
                        return ['côngthức(sql)', 'côngthức', 'sql', 'formula', 'nộidung', 'expression'].includes(nk);
                    });
                    const targetCol = targetKey ? row[targetKey] : null;
                    const expression = exprKey ? row[exprKey] : null;
                    if (targetCol && expression) {
                        allExtracted.push({
                            targetCol: String(targetCol).trim(),
                            expression: String(expression).trim()
                        });
                    }
                });
            }
            if (allExtracted.length === 0) {
                alert("Không tìm thấy dữ liệu hợp lệ. Vui lòng đảm bảo file Excel có cột 'Mã tiêu chí' và 'Công thức'.");
                return;
            }
            const newFormulas = [...customFormulas];
            allExtracted.forEach(item => {
                const existingIdx = newFormulas.findIndex(f => 
                    String(f.targetCol).toLowerCase() === String(item.targetCol).toLowerCase()
                );
                if (existingIdx >= 0) {
                    newFormulas[existingIdx] = item;
                } else {
                    newFormulas.push(item);
                }
            });
            setCustomFormulas(newFormulas);
            setIsImportModalOpen(false);
            setImportFiles([]);
            setSelectedIndices(new Set());
            alert(`Thành công! Đã trích xuất ${allExtracted.length} công thức.`);
        } catch (err) {
            console.error("Extraction Error:", err);
            alert("Lỗi: Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.");
        }
    };

    const handleSaveClick = () => {
        if (!newFormulaTarget || !newFormulaExpr.trim()) {
            alert("Vui lòng nhập đủ Mã tiêu chí và Công thức."); return;
        }
        const normalizedTarget = newFormulaTarget.trim().toLowerCase();
        const isDuplicate = customFormulas.some((f, idx) => 
            idx !== editingFormulaIdx && f.targetCol.trim().toLowerCase() === normalizedTarget
        );
        if (isDuplicate) {
            alert(`Lỗi: Mã tiêu chí "${newFormulaTarget}" đã tồn tại trong hệ thống. Vui lòng sử dụng mã khác hoặc chỉnh sửa công thức hiện có.`);
            return;
        }
        if (editingFormulaIdx >= 0) {
            const updatedFormulas = [...customFormulas];
            updatedFormulas[editingFormulaIdx] = { targetCol: newFormulaTarget, expression: newFormulaExpr };
            setCustomFormulas(updatedFormulas);
        } else {
            setCustomFormulas([...customFormulas, { targetCol: newFormulaTarget, expression: newFormulaExpr }]);
        }
        handleCancelEditClick();
    };

    const handleCancelEditClick = () => {
        setEditingFormulaIdx(-1);
        setNewFormulaTarget('');
        setNewFormulaExpr('');
        setHasPreviewed(false);
        setPreviewVariables([]);
    };

    const handleEditClick = (f, idx) => {
        setEditingFormulaIdx(idx);
        setNewFormulaTarget(f.targetCol);
        setNewFormulaExpr(f.expression);
        const vars = extractVariables(f.expression);
        setPreviewVariables(vars);
        setHasPreviewed(true);
    };

    const handleDeleteClick = (idx) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) {
            setCustomFormulas(customFormulas.filter((_, i) => i !== idx));
            if (testFormulaIdx === idx) {
                setTestFormulaIdx(-1); setTestResult(null); setTestVariables({}); setTestTargetVal(null); setTestEmpFound(false);
            }
            if (editingFormulaIdx === idx) {
                handleCancelEditClick();
            }
        }
    };

    const handleBulkDelete = () => {
        if (customFormulas.length === 0) return;
        if (selectedIndices.size > 0) {
            if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIndices.size} công thức đã chọn?`)) {
                const newFormulas = customFormulas.filter((_, idx) => !selectedIndices.has(idx));
                setCustomFormulas(newFormulas);
                setSelectedIndices(new Set());
            }
        } else {
            if (window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ danh sách công thức? Thao tác này không thể hoàn tác.")) {
                setCustomFormulas([]);
                setSelectedIndices(new Set());
            }
        }
    };

    const toggleSelection = (idx) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setSelectedIndices(newSet);
    };

    const handleTestEmpIdChange = (e) => {
        setTestEmpId(e.target.value);
        setTestEmpFound(false);
        setIsCalculated(false);
        setTestResult(null);
        setTestVariables({});
        setTestTargetVal(null);
        setCalcLogs([]);
    };

    const handleSandboxFormulaSelect = (idx) => {
        setTestFormulaIdx(idx);
        const formula = customFormulas[idx];
        if (formula) {
            // Chỉ gán tên cột nếu đã nạp báo cáo và có mapping thành công
            if (reportColumns.length > 0 && formula.mappedCol) {
                setCompareCol(formula.mappedCol);
            } else {
                setCompareCol(''); // Để trống nếu chưa nạp báo cáo hoặc chưa ánh xạ
            }
        }
        setIsSandboxComboOpen(false);
        setSandboxSearch('');
        setTestResult(null);
        setIsCalculated(false);
        setCalcLogs([]);
        setIsFromTransferred(false);
    };

    const handleCompareColSelect = (col) => {
        setCompareCol(col);
        setIsCompareColComboOpen(false);
        setCompareColSearch('');
    };

    const handleEmpSelect = (id) => {
        setTestEmpId(id);
        setIsEmpComboOpen(false);
        setEmpSearch('');
        setTestEmpFound(true);
        setIsCalculated(false);
    };

    // Lấy danh sách mã nhân viên từ reportData
    const empOptions = React.useMemo(() => {
        if (!reportData || reportData.length === 0) return [];
        const firstRow = reportData[0];
        const empKey = Object.keys(firstRow).find(k => {
            const nk = normalizeHeader(k);
            return ['mãnv', 'manv', 'mãnhânviên', 'manhanvien', 'mã', 'id', 'empid', 'empcode'].includes(nk);
        });
        if (!empKey) return [];
        const ids = reportData.map(r => String(r[empKey] || '').trim()).filter(id => id !== '');
        return [...new Set(ids)];
    }, [reportData]);

    const [compareStatus, setCompareStatus] = React.useState(null); 
    const [diffAmount, setDiffAmount] = React.useState(null);

    // Hàm helper để lấy giá trị từ Excel/Báo cáo một cách chính xác
    const getExcelValue = (empId, colName) => {
        if (!empId || !colName) return undefined;
        
        // 1. Tìm trong dữ liệu báo cáo (reportData)
        if (reportData.length > 0) {
            const empRow = reportData.find(r => {
                const idKey = Object.keys(r).find(k => {
                    const nk = normalizeHeader(k);
                    return ['mãnv', 'manv', 'mãnhânviên', 'manhanvien', 'mã', 'id', 'empid', 'empcode'].includes(nk);
                });
                return idKey && String(r[idKey]).trim() === String(empId).trim();
            });
            
            if (empRow) {
                // Thử tìm khớp trực tiếp
                if (empRow[colName] !== undefined) return empRow[colName];
                // Thử tìm khớp qua normalize
                const normCol = normalizeHeader(colName);
                const actualKey = Object.keys(empRow).find(k => normalizeHeader(k) === normCol);
                if (actualKey) return empRow[actualKey];
            }
        }

        // 2. Tìm trong kết quả đối soát (results)
        const empRow = results?.find(r => String(r[keyCol]) === String(empId).trim());
        if (empRow) {
            // Thử tìm trong baseVals (file gốc)
            const normCol = normalizeHeader(colName);
            const baseKey = Object.keys(empRow.baseVals).find(k => normalizeHeader(k) === normCol);
            if (baseKey) return empRow.baseVals[baseKey];

            // Thử tìm trong targetVals (file đối soát)
            for (const tfId in empRow.targetVals) {
                const targetKey = Object.keys(empRow.targetVals[tfId]).find(k => normalizeHeader(k) === normCol);
                if (targetKey) return empRow.targetVals[tfId][targetKey];
            }
        }
        
        return undefined;
    };

    const handleCompare = () => {
        if (!testEmpId) { alert("Vui lòng chọn Mã nhân viên."); return; }
        if (!compareCol) { alert("Vui lòng chọn Cột dữ liệu muốn so sánh."); return; }

        const excelValRaw = getExcelValue(testEmpId, compareCol);

        if (excelValRaw === undefined) {
            alert(`Không tìm thấy dữ liệu cho nhân viên ${testEmpId} và cột ${compareCol}`);
            return;
        }

        const liveVal = isFromTransferred ? sandboxResult : testResult;
        if (liveVal === null || liveVal === undefined || liveVal === '') {
            alert("Vui lòng thực hiện tính toán kết quả trước.");
            return;
        }

        const parseNum = (v) => {
            if (v === null || v === undefined) return NaN;
            if (typeof v === 'number') return v;
            const clean = String(v).replace(/,/g, '').replace(/\s/g, '');
            return parseFloat(clean);
        };

        const nLive = parseNum(liveVal);
        const nExcel = parseNum(excelValRaw);

        if (!isNaN(nLive) && !isNaN(nExcel)) {
            const diff = Math.abs(nLive - nExcel);
            if (diff < 0.001) {
                setCompareStatus('match');
                setDiffAmount(0);
            } else {
                setCompareStatus('diff');
                setDiffAmount(diff);
            }
        } else {
            const sLive = String(liveVal).trim().toLowerCase();
            const sExcel = String(excelValRaw || '').trim().toLowerCase();
            if (sLive === sExcel) {
                setCompareStatus('match');
                setDiffAmount(0);
            } else {
                setCompareStatus('diff');
                setDiffAmount(null);
            }
        }
    };

    return (
        <>
            <div className={`animate-fade-in flex flex-col h-full min-h-[600px] ${themeUI.cardBg} rounded-xl shadow-sm border overflow-hidden`}>
                <div className={`flex border-b ${themeUI.border} bg-black/5 dark:bg-black/20 px-6 pt-4 shrink-0`}>
                    <button
                        className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${formulaTab === 'define' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        onClick={() => setFormulaTab('define')}
                        title="Thiết lập các công thức tính toán mới"
                    >
                        1. Định Nghĩa Công Thức
                    </button>
                    <button
                        className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${formulaTab === 'sandbox' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        onClick={() => setFormulaTab('sandbox')}
                        title="Chế độ mô phỏng và kiểm tra kết quả tính toán"
                    >
                        2. Sandbox Mô Phỏng
                    </button>
                </div>

                <div className={`overflow-y-auto flex-1 p-6 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                    {formulaTab === 'define' && (
                        <div className="flex flex-col">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-8 flex flex-col gap-6">
                                    <div className={`p-6 rounded-2xl border shadow-sm flex-1 flex flex-col ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                                        <div className="mb-6 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                </div>
                                                <div>
                                                    <h3 className={`font-bold ${themeUI.textTitle}`}>Soạn thảo công thức</h3>
                                                    <p className={`text-[10px] ${themeUI.textMuted}`}>Hỗ trợ SQL, IF/CASE và các toán tử cơ bản</p>
                                                </div>
                                            </div>
                                            {editingFormulaIdx !== -1 && (
                                                <button onClick={() => setEditingFormulaIdx(-1)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> Hủy chỉnh sửa
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-5 flex-1 flex flex-col">
                                            <div>
                                                <label className={`font-bold text-xs mb-2 block uppercase tracking-widest ${themeUI.textMuted}`}>Mã tiêu chí (Cột Kết quả)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="VD: Hệ số chức danh..." 
                                                    value={newFormulaTarget} 
                                                    onChange={(e) => setNewFormulaTarget(e.target.value)} 
                                                    className={`w-full p-3 text-sm font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${themeUI.inputBg} border-slate-200 dark:border-slate-600`} 
                                                />
                                            </div>

                                            <div className="flex-1 flex flex-col min-h-[200px]">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className={`font-bold text-xs uppercase tracking-widest ${themeUI.textMuted}`}>Công thức tính toán</label>
                                                    <span className="text-[10px] text-indigo-500 font-bold">Hỗ trợ: + - * / ( ) % | CASE WHEN...</span>
                                                </div>
                                                <textarea 
                                                    placeholder="VD: Hệ số nhân viên * TT_He_so_lam_viec" 
                                                    value={newFormulaExpr} 
                                                    onChange={(e) => setNewFormulaExpr(e.target.value)} 
                                                    className={`w-full p-4 text-sm font-mono leading-relaxed border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex-1 resize-none ${themeUI.inputBg} border-slate-200 dark:border-slate-600 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <button onClick={handlePreviewFormula} className={`py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    Kiểm tra cấu trúc
                                                </button>
                                                <button onClick={handleSaveClick} className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                                    {editingFormulaIdx !== -1 ? 'Cập nhật Công thức' : 'Lưu Công thức Mới'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-4 flex flex-col gap-6">
                                    <div className={`p-6 rounded-2xl border shadow-sm flex-1 ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                                        <h4 className={`font-bold text-xs uppercase tracking-widest mb-4 ${themeUI.textMuted}`}>Cấu trúc tiêu chí bóc tách:</h4>
                                        {!hasPreviewed ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-50">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                </div>
                                                <p className="text-xs italic px-6">Hãy nhập công thức bên trái và bấm "Kiểm tra cấu trúc" để hệ thống phân tích các tiêu chí thành phần.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {previewVariables.length > 0 ? (
                                                    previewVariables.map((v, idx) => {
                                                        const exists = customFormulas.some(f => f.targetCol.trim().toLowerCase() === v.trim().toLowerCase());
                                                        return (
                                                            <div key={idx} className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-700 hover:border-indigo-500/50' : 'bg-slate-50 border-slate-200 hover:border-indigo-500/50'}`}>
                                                                <span className="font-mono font-bold text-indigo-500 truncate mr-2">{v}</span>
                                                                {exists ? (
                                                                    <span className="shrink-0 px-2 py-0.5 bg-green-500/10 text-green-500 rounded-md font-black text-[9px] uppercase tracking-wider">Tồn tại</span>
                                                                ) : (
                                                                    <span className="shrink-0 px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md font-black text-[9px] uppercase tracking-wider">Thiếu</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-green-500 font-bold bg-green-500/10 p-3 rounded-lg border border-green-500/20 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                        Công thức không có biến phụ thuộc.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 border-t pt-8 dark:border-slate-800 shrink-0">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <div className="flex flex-col gap-1">
                                        <label className={`font-bold text-sm block ${themeUI.textTitle}`}>Danh sách công thức đã lưu ({customFormulas.length}):</label>
                                        <p className={`text-[10px] ${themeUI.textMuted}`}>Click vào các dòng để chọn nhiều mục. Bấm Xóa để xử lý.</p>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="relative flex-1 sm:w-64">
                                            <input 
                                                type="text" 
                                                placeholder="Tìm mã tiêu chí..." 
                                                value={formulaSearch}
                                                onChange={(e) => setFormulaSearch(e.target.value)}
                                                className={`w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${themeUI.inputBg}`}
                                            />
                                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        <button 
                                            onClick={handleBulkDelete}
                                            disabled={customFormulas.length === 0}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center shadow-sm border ${selectedIndices.size > 0 ? 'bg-red-500 text-white border-red-600 hover:bg-red-600' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:bg-red-200'}`}
                                        >
                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            {selectedIndices.size > 0 ? `Xóa ${selectedIndices.size} mục` : 'Xóa tất cả'}
                                        </button>
                                        <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-all shadow-sm flex items-center border border-indigo-200 dark:border-indigo-700/50 whitespace-nowrap"><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Import từ Excel</button>
                                    </div>
                                </div>
                                {customFormulas.length === 0 ? (
                                    <p className={`text-sm italic ${themeUI.textMuted}`}>Chưa có công thức nào được tạo.</p>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {customFormulas
                                            .map((f, idx) => ({ ...f, originalIdx: idx }))
                                            .filter(f => {
                                                const search = formulaSearch.trim().toLowerCase();
                                                return f.targetCol.toLowerCase().includes(search);
                                            })
                                            .map((f) => (
                                                <div 
                                                    key={f.originalIdx} 
                                                    onClick={() => toggleSelection(f.originalIdx)}
                                                    className={`flex items-center justify-between p-3 border rounded-lg shadow-sm group transition-all cursor-pointer ${selectedIndices.has(f.originalIdx) ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 dark:bg-indigo-900/20' : (isDarkMode ? 'bg-slate-800 border-slate-600 hover:border-slate-500' : 'bg-white border-gray-200 hover:border-indigo-300')} ${editingFormulaIdx === f.originalIdx ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
                                                >
                                                    <div className="flex flex-col gap-1 w-full min-w-0 pr-4">
                                                        <span className={`font-bold text-sm truncate ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{f.targetCol}</span>
                                                        <span className={`font-mono text-[10px] truncate ${themeUI.textMain} opacity-70`} title={f.expression}>{f.expression}</span>
                                                    </div>
                                                    <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                        {f.targetCol.toUpperCase().startsWith('TT_') && (
                                                            <button onClick={() => { setChainViewFormula(f); setPreviousStep(currentStep); setCurrentStep('chain_trace'); }} className="p-1.5 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors" title="Truy nguồn gốc (Chain Tracer)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg></button>
                                                        )}
                                                        <button onClick={() => handleEditClick(f, f.originalIdx)} className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors" title="Sửa công thức này"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                                                        <button onClick={() => handleDeleteClick(f.originalIdx)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors" title="Xóa"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {formulaTab === 'sandbox' && (
                        <div className="flex flex-col">
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <label 
                                    className="flex-1 min-w-[200px]"
                                    onDragEnter={(e) => handleDrag(e, 'report')}
                                    onDragOver={(e) => handleDrag(e, 'report')}
                                    onDragLeave={(e) => handleDrag(e, 'report')}
                                    onDrop={(e) => handleDrop(e, 'report')}
                                >
                                    <span className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${themeUI.textMuted}`}>1. Import Báo cáo</span>
                                    <div className={`relative flex items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragActive.report ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' : 'hover:border-indigo-500/50 hover:bg-indigo-500/5'} ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                                        <input type="file" accept=".xlsx,.xls" onChange={handleImportReport} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dragActive.report ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m3 2h12a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                            </div>
                                            <span className={`text-xs font-bold ${themeUI.textMain}`}>
                                                {reportColumns.length > 0 ? `Đã nạp ${reportColumns.length} cột` : "Kéo thả hoặc Chọn Báo cáo"}
                                            </span>
                                        </div>
                                    </div>
                                </label>

                                <label 
                                    className="flex-1 min-w-[200px]"
                                    onDragEnter={(e) => handleDrag(e, 'formula')}
                                    onDragOver={(e) => handleDrag(e, 'formula')}
                                    onDragLeave={(e) => handleDrag(e, 'formula')}
                                    onDrop={(e) => handleDrop(e, 'formula')}
                                >
                                    <span className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${themeUI.textMuted}`}>2. Import Công thức</span>
                                    <div className={`relative flex items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragActive.formula ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'hover:border-emerald-500/50 hover:bg-emerald-500/5'} ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                                        <input type="file" accept=".xlsx,.xls" onChange={handleImportFormulaMapping} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dragActive.formula ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </div>
                                            <span className={`text-xs font-bold ${themeUI.textMain}`}>
                                                {rawFormulaData.length > 0 ? `Đã nạp ${rawFormulaData.length} công thức` : "Kéo thả hoặc Chọn File Công thức"}
                                            </span>
                                        </div>
                                    </div>
                                </label>
                                <div className="flex items-end pb-1">
                                    <button 
                                        onClick={handleRunMapping}
                                        disabled={reportColumns.length === 0 || rawFormulaData.length === 0}
                                        className={`h-[76px] px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex flex-col items-center justify-center gap-2 shadow-lg ${reportColumns.length > 0 && rawFormulaData.length > 0 ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-500/20 active:scale-95' : 'bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                        Kiểm tra Ánh xạ
                                    </button>
                                </div>
                            </div>

                            {customFormulas.length === 0 && !isFromTransferred ? (
                                <div className={`p-8 text-center flex-1 flex flex-col items-center justify-center`}>
                                    <span className="text-4xl mb-3">🧪</span>
                                    <p className={`${themeUI.textMain} font-bold text-lg`}>Chưa có dữ liệu để kiểm tra.</p>
                                    <p className={`${themeUI.textMuted} mt-1`}>Vui lòng tạo công thức hoặc chuyển từ Phân tách sang.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    {isFromTransferred && sandboxResult !== null && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between animate-fade-in mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Đã nhận kết quả từ Phân Tách</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Giá trị Live: <span className="text-amber-500 font-black font-mono">{sandboxResult}</span></p>
                                                </div>
                                            </div>
                                            <button onClick={() => setIsFromTransferred(false)} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-500/5">Hủy</button>
                                        </div>
                                    )}

                                    <div className={`p-6 border rounded-2xl flex flex-col lg:grid lg:grid-cols-12 gap-6 shadow-sm shrink-0 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-indigo-50/30 border-indigo-100/50'}`}>
                                        {/* 1. Nhân viên */}
                                        <div className="lg:col-span-3 flex flex-col relative" ref={empComboRef}>
                                            <label className={`font-black text-[10px] mb-2 block uppercase tracking-[0.2em] ${themeUI.textMuted}`}>1. Nhân viên</label>
                                            <div 
                                                onClick={() => setIsEmpComboOpen(!isEmpComboOpen)} 
                                                className={`w-full p-3 border rounded-xl cursor-pointer flex justify-between items-center font-bold text-sm transition-all ${themeUI.inputBg} ${isEmpComboOpen ? 'border-indigo-500 ring-2 ring-indigo-500/30' : (isDarkMode ? 'border-slate-600' : 'border-slate-200')}`}
                                            >
                                                <span className={testEmpId ? "" : "opacity-40 font-normal truncate"}>
                                                    {testEmpId || "Chọn NV..."}
                                                </span>
                                                <svg className={`w-4 h-4 transition-transform ${isEmpComboOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            </div>
                                            
                                            {isEmpComboOpen && (
                                                <div className={`absolute left-0 right-0 z-[60] mt-[75px] border rounded-xl shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-slate-200'}`}>
                                                    <div className="p-2 border-b dark:border-slate-700">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Tìm mã NV..." 
                                                            value={empSearch} 
                                                            onChange={(e) => setEmpSearch(e.target.value)} 
                                                            className={`w-full p-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${themeUI.inputBg}`} 
                                                            autoFocus 
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <ul className={`max-h-60 overflow-y-auto p-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                                                        {empOptions.filter(id => String(id).toLowerCase().includes(empSearch.trim().toLowerCase())).map(id => (
                                                            <li key={`emp-opt-${id}`} onClick={(e) => { e.stopPropagation(); handleEmpSelect(id); }} className={`p-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-indigo-50 text-gray-800'} ${testEmpId === id ? (isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-800') : ''}`}>{id}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2. Cột so sánh */}
                                        <div className="lg:col-span-4 flex flex-col relative" ref={compareColComboRef}>
                                            <label className={`font-black text-[10px] mb-2 block uppercase tracking-[0.2em] ${themeUI.textMuted}`}>2. Cột so sánh</label>
                                            <div 
                                                onClick={() => setIsCompareColComboOpen(!isCompareColComboOpen)} 
                                                className={`w-full p-3 border rounded-xl cursor-pointer flex justify-between items-center font-bold text-sm transition-all ${themeUI.inputBg} ${isCompareColComboOpen ? 'border-indigo-500 ring-2 ring-indigo-500/30' : (isDarkMode ? 'border-slate-600' : 'border-slate-200')}`}
                                            >
                                                <span className={compareCol ? "" : "opacity-40 font-normal truncate"}>
                                                    {compareCol || "-- Chọn cột Excel --"}
                                                </span>
                                                <svg className={`w-4 h-4 transition-transform ${isCompareColComboOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            </div>
                                            
                                            {isCompareColComboOpen && (
                                                <div className={`absolute left-0 right-0 z-50 mt-[75px] border rounded-xl shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-slate-200'}`}>
                                                    <div className="p-2 border-b dark:border-slate-700">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Tìm tên cột..." 
                                                            value={compareColSearch} 
                                                            onChange={(e) => setCompareColSearch(e.target.value)} 
                                                            className={`w-full p-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${themeUI.inputBg}`} 
                                                            autoFocus 
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <ul className={`max-h-60 overflow-y-auto p-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                                                        {(reportColumns.length > 0 ? reportColumns : valCols).filter(col => String(col).toLowerCase().includes(compareColSearch.trim().toLowerCase())).map(col => (
                                                            <li key={`compare-col-${col}`} onClick={(e) => { e.stopPropagation(); handleCompareColSelect(col); }} className={`p-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-indigo-50 text-gray-800'} ${compareCol === col ? (isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-800') : ''}`}>{col} {reportColumns.length > 0 ? "(Báo cáo)" : ""}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* 3. Công thức so sánh */}
                                        <div className="lg:col-span-5 flex flex-col relative" ref={sandboxComboRef}>
                                            <label className={`font-black text-[10px] mb-2 block uppercase tracking-[0.2em] ${themeUI.textMuted}`}>3. Công thức so sánh</label>
                                            <div 
                                                onClick={() => setIsSandboxComboOpen(!isSandboxComboOpen)} 
                                                className={`w-full p-3 border rounded-xl cursor-pointer flex justify-between items-center font-bold text-sm transition-all ${themeUI.inputBg} ${isSandboxComboOpen ? 'border-indigo-500 ring-2 ring-indigo-500/30' : (isDarkMode ? 'border-slate-600' : 'border-slate-200')}`}
                                            >
                                                <span className={testFormulaIdx >= 0 ? "" : "opacity-40 font-normal truncate"}>
                                                    {testFormulaIdx >= 0 && customFormulas[testFormulaIdx] ? customFormulas[testFormulaIdx].targetCol : "-- Chọn công thức --"}
                                                </span>
                                                <svg className={`w-4 h-4 transition-transform ${isSandboxComboOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            </div>
                                            {isSandboxComboOpen && (
                                                <div className={`absolute left-0 right-0 z-50 mt-[75px] border rounded-xl shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-slate-200'}`}>
                                                    <div className="p-2 border-b dark:border-slate-700">
                                                        <input type="text" placeholder=" Tìm mã..." value={sandboxSearch} onChange={(e) => setSandboxSearch(e.target.value)} className={`w-full p-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${themeUI.inputBg}`} autoFocus onClick={(e) => e.stopPropagation()} />
                                                    </div>
                                                    <ul className={`max-h-60 overflow-y-auto p-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                                                        {customFormulas.map((f, idx) => ({ ...f, idx })).filter(f => f.targetCol.toLowerCase().includes(sandboxSearch.trim().toLowerCase()) || (f.mappedCol && f.mappedCol.toLowerCase().includes(sandboxSearch.trim().toLowerCase()))).map(f => (
                                                            <li key={`sbox-form-${f.idx}`} onClick={(e) => { e.stopPropagation(); handleSandboxFormulaSelect(f.idx); }} className={`p-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-indigo-50 text-gray-800'} ${testFormulaIdx === f.idx ? (isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-800') : ''}`}>
                                                                <div className="flex flex-col">
                                                                    <span>{f.targetCol}</span>
                                                                    {f.mappedCol && <span className="text-[10px] opacity-50 italic">→ {f.mappedCol}</span>}
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Buttons */}
                                        <div className="lg:col-span-12 flex gap-3 mt-2">
                                            <button 
                                                onClick={handleTestFormulaLoad} 
                                                disabled={!testEmpId || testFormulaIdx < 0} 
                                                className={`flex-1 h-[46px] rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${!testEmpId || testFormulaIdx < 0 ? 'bg-slate-700 text-slate-500 opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
                                            >
                                                Nạp Biến
                                            </button>
                                            <button 
                                                onClick={handleCompare} 
                                                disabled={!testEmpId || !compareCol || (!isFromTransferred && !isCalculated)} 
                                                className={`flex-1 h-[46px] rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${!testEmpId || !compareCol || (!isFromTransferred && !isCalculated) ? 'bg-slate-700 text-slate-500 opacity-50' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                                So sánh
                                            </button>
                                        </div>
                                    </div>

                                    {testEmpFound && (
                                        <div className="flex flex-col lg:flex-row gap-8 mt-2">
                                            {!isFromTransferred && testFormulaIdx >= 0 && (
                                                <div className="w-full lg:w-1/2 flex flex-col animate-fade-in">
                                                    <div className="flex items-center justify-between border-b pb-2 mb-4 shrink-0">
                                                        <h4 className={`font-black text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>Các Biến Số Thành Phần</h4>
                                                        <button onClick={handleCalculateSandboxFormula} className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:underline">Tính Kết Quả</button>
                                                    </div>
                                                    {Object.keys(testVariables).length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl border-slate-700/30 bg-slate-800/5 p-8 text-center h-[200px]"><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Không có biến số</p></div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                            {Object.keys(testVariables).map(varName => (
                                                                <div key={`var-${varName}`} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                                    <span className={`w-1/2 font-bold text-xs truncate ${themeUI.textMain}`} title={varName}>{varName}</span>
                                                                    <input type="text" className={`w-1/2 p-2 border rounded-lg font-mono text-xs text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 ${themeUI.inputBg} ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} value={testVariables[varName]} onChange={(e) => { const newVars = { ...testVariables, [varName]: e.target.value }; setTestVariables(newVars); setIsCalculated(false); setCalcLogs([]); }} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="mt-4 flex items-center justify-between"><label className={`flex items-center gap-2 cursor-pointer transition-colors w-max ${isDarkMode ? 'text-indigo-300 hover:text-indigo-100' : 'text-indigo-700 hover:text-indigo-900'}`}><input type="checkbox" checked={showConsole} onChange={(e) => setShowConsole(e.target.checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer rounded border-gray-300" /><span className="font-black text-[10px] uppercase tracking-widest">Bật Console Log</span></label></div>
                                                </div>
                                            )}

                                            <div className={`flex flex-col gap-6 animate-fade-in ${isFromTransferred ? 'w-full' : 'w-full lg:w-1/2'}`}>
                                                <div className={`p-8 border rounded-3xl flex flex-col items-center justify-center shadow-2xl relative min-h-[350px] overflow-hidden ${isDarkMode ? 'bg-slate-900/40 border-slate-700 shadow-black/50' : 'bg-white border-indigo-100 shadow-indigo-500/5'}`}>
                                                    <div className="absolute top-0 right-0 p-8 opacity-5"><svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></div>
                                                    <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-md">
                                                        <div className="flex flex-col items-center gap-4"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">KẾT QUẢ LIVE</span><div className={`w-32 h-32 rounded-3xl flex flex-col items-center justify-center shadow-xl border-2 ${isDarkMode ? 'bg-indigo-950/30 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}><span className="text-2xl font-black font-mono tracking-tighter text-white">{isFromTransferred ? (sandboxResult ?? '-') : (testResult ?? '-')}</span><span className="text-[8px] font-bold text-indigo-400 mt-1 uppercase">Sẵn sàng</span></div></div>
                                                        <div className="hidden md:flex flex-col items-center"><div className="w-[1px] h-12 bg-gradient-to-t from-transparent via-slate-500/20 to-transparent"></div><div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 bg-slate-900">VS</div><div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-slate-500/20 to-transparent"></div></div>
                                                        <div className="flex flex-col items-center gap-4">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">DỮ LIỆU EXCEL</span>
                                                            <div className={`w-32 h-32 rounded-3xl flex flex-col items-center justify-center shadow-xl border-2 ${isDarkMode ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                                                                <span className="text-2xl font-black font-mono tracking-tighter text-white">
                                                                    {(() => {
                                                                        const val = getExcelValue(testEmpId, compareCol);
                                                                        return val ?? '-';
                                                                    })()}
                                                                </span>
                                                                <span className="text-[8px] font-bold text-emerald-400 mt-1 uppercase truncate w-24 px-2 text-center">{compareCol || 'Chưa chọn cột'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {compareStatus && (<div className={`mt-12 px-8 py-4 rounded-2xl border flex flex-col items-center animate-bounce-subtle ${compareStatus === 'match' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}><div className="flex items-center gap-3">{compareStatus === 'match' ? (<><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span className="text-lg font-black uppercase tracking-widest">THÀNH CÔNG!</span></>) : (<><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span className="text-lg font-black uppercase tracking-widest">KHÔNG TRÙNG KHỚP</span></>)}</div>{compareStatus === 'diff' && diffAmount !== null && (<p className="mt-2 text-sm font-black font-mono">CHÊNH LỆCH: {diffAmount.toLocaleString()}</p>)}</div>)}
                                                </div>
                                                {showConsole && isCalculated && calcLogs.length > 0 && (
                                                    <div className="w-full bg-[#0a0f1c] border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-fade-in shrink-0">
                                                        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0"><div className="flex items-center gap-2"><div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div><div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div><div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">SIMULATION TERMINAL</span></div><button className="text-slate-500 hover:text-white transition-colors" onClick={() => setCalcLogs([])}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
                                                        <div className="p-4 text-[10px] font-mono text-green-400 overflow-y-auto max-h-[300px] leading-relaxed whitespace-pre-wrap text-left custom-dark-scrollbar bg-black/40">{calcLogs.map((log, i) => { let color = "text-slate-300"; if (log.includes("[ERROR]") || log.includes("[FATAL")) color = "text-red-400"; else if (log.includes("[START]")) color = "text-blue-400 font-bold"; else if (log.startsWith("  ->")) color = "text-purple-300"; else if (log.includes("❌ FAIL")) color = "text-gray-500 line-through decoration-gray-600"; else if (log.includes("✅ TRUE")) color = "text-green-400 font-bold"; else if (log.includes("CHỌN KẾT QUẢ") && !log.includes("ELSE")) color = "text-yellow-300 font-bold"; else if (log.includes("RỚT VÀO ELSE")) color = "text-orange-400 italic"; else if (log.includes("CHỌN KẾT QUẢ ELSE")) color = "text-yellow-500 font-bold"; return <div key={i} className={`mb-1.5 ${color} break-words`}>{log}</div> })}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <FormulaImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} files={importFiles} setFiles={setImportFiles} onExtract={handleStartExtraction} importRef={importFormulaRef} />
            </div>

            {isMappingModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className={`w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-indigo-500/10'}`}>
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-transparent">
                            <div>
                                <h3 className={`text-xl font-black ${themeUI.textTitle} tracking-tight`}>Kết Quả Kiểm Tra Ánh Xạ</h3>
                                <p className={`text-xs ${themeUI.textMuted} mt-1`}>Hệ thống so sánh các cột trong Báo cáo với File công thức đã nạp.</p>
                            </div>
                            <button onClick={() => setIsMappingModalOpen(false)} className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <div className={`flex-1 overflow-auto ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                            <table className="w-full text-left border-collapse">
                                <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                    <tr>
                                        <th className={`p-4 text-[10px] font-black uppercase tracking-widest border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>Cột Tên (Báo cáo)</th>
                                        <th className={`p-4 text-[10px] font-black uppercase tracking-widest border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>Tên (File Công thức)</th>
                                        <th className={`p-4 text-[10px] font-black uppercase tracking-widest border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>Công Thức</th>
                                        <th className={`p-4 text-[10px] font-black uppercase tracking-widest border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mappingPreview?.map((m, idx) => {
                                        let statusText = '';
                                        let statusColor = '';
                                        let rowBg = '';
                                        
                                        if (m.status === 'missing_formula') {
                                            statusText = 'Thiếu Công thức';
                                            statusColor = 'text-red-500 bg-red-500/10 border-red-500/20';
                                            rowBg = isDarkMode ? 'hover:bg-red-500/5' : 'hover:bg-red-50/50';
                                        } else if (m.status === 'missing_config') {
                                            statusText = 'Thiếu Thiết lập';
                                            statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
                                            rowBg = isDarkMode ? 'hover:bg-amber-500/5' : 'hover:bg-amber-50/50';
                                        } else {
                                            statusText = 'Thành công';
                                            statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
                                            rowBg = isDarkMode ? 'hover:bg-emerald-500/5' : 'hover:bg-emerald-50/50';
                                        }

                                        return (
                                            <tr key={idx} className={`border-b transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} ${rowBg}`}>
                                                <td className="p-4">
                                                    <span className={`text-sm font-bold ${themeUI.textMain}`}>{m.reportCol}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-xs opacity-70 ${themeUI.textMain}`}>{m.formulaTargetName}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-mono opacity-70 break-all">{m.formula}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusColor}`}>
                                                        {statusText}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t dark:border-slate-800 flex justify-end gap-4 bg-slate-50/50 dark:bg-black/20">
                            <button onClick={() => setIsMappingModalOpen(false)} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>Hủy bỏ</button>
                            <button 
                                onClick={confirmMapping} 
                                disabled={!mappingPreview?.some(m => m.status !== 'missing_formula')}
                                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Xác nhận & Cập nhật
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}