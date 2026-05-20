import { useState, useRef } from 'react';
import { extractVariables, evaluateFormula } from '../utils/astCompiler';
import { normalizeHeader, extractCleanName } from '../utils/excelUtils';

export function useFormulaAssistant(baseFile, targetFiles, keyCol, results, setToastMessage, customFormulas, setCustomFormulas) {
    const [formulaTab, setFormulaTab] = useState('define'); // 'define' or 'sandbox'
    const [newFormulaTarget, setNewFormulaTarget] = useState('');
    const [newFormulaExpr, setNewFormulaExpr] = useState('');
    const [previewVariables, setPreviewVariables] = useState([]);
    const [hasPreviewed, setHasPreviewed] = useState(false);
    const [editingFormulaIdx, setEditingFormulaIdx] = useState(-1);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFiles, setImportFiles] = useState([]);
    const [formulaSearch, setFormulaSearch] = useState('');

    const importFormulaRef = useRef(null);

    // Sandbox states
    const [testEmpId, setTestEmpId] = useState('');
    const [testFormulaIdx, setTestFormulaIdx] = useState(-1);
    const [isSandboxComboOpen, setIsSandboxComboOpen] = useState(false);
    const [sandboxSearch, setSandboxSearch] = useState('');
    const sandboxComboRef = useRef(null);
    const [testEmpFound, setTestEmpFound] = useState(false);
    const [testVariables, setTestVariables] = useState({});
    const [showConsole, setShowConsole] = useState(false);
    const [isCalculated, setIsCalculated] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [testTargetVal, setTestTargetVal] = useState(null);
    const [calcLogs, setCalcLogs] = useState([]);

    const handlePreviewFormula = () => {
        if (!newFormulaExpr.trim()) {
            alert("Vui lòng nhập công thức tính toán để kiểm tra.");
            return;
        }
        const vars = extractVariables(newFormulaExpr);
        setPreviewVariables(vars);
        setHasPreviewed(true);
    };

    const handleImportFormulas = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setImportFiles(prev => [...prev, ...files]);
        e.target.value = null; 
    };

    const handleExtractFormulas = async () => {
        if (importFiles.length === 0) {
            alert("Vui lòng chọn ít nhất một file."); return;
        }

        let totalImported = 0;
        let newFormulasCount = 0;
        let skippedFiles = [];

        for (const file of importFiles) {
            try {
                const data = await file.arrayBuffer();
                const wb = window.XLSX.read(data, { type: 'array' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                if (jsonData.length < 2) {
                    skippedFiles.push(`${file.name} (File trống hoặc ít dữ liệu)`);
                    continue;
                }
                
                const headerRow = jsonData[0] || [];
                let targetIdx = -1;
                let exprIdx = -1;

                headerRow.forEach((h, idx) => {
                    const str = String(h).toLowerCase().trim();
                    if (str === 'mã' || str.includes('mã tiêu chí') || str.includes('cột đích') || str === 'target' || str.includes('mã cột')) targetIdx = idx;
                    if (str.includes('công thức') || str === 'formula' || str.includes('biểu thức') || str === 'expression') exprIdx = idx;
                });

                if (targetIdx === -1 || exprIdx === -1) {
                    skippedFiles.push(`${file.name} (Không tìm thấy cột Mã/Công thức)`);
                    continue;
                }

                const imported = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (row && row[targetIdx] && row[exprIdx]) {
                        imported.push({ targetCol: String(row[targetIdx]).trim(), expression: String(row[exprIdx]).trim() });
                    }
                }
                
                if (imported.length > 0) {
                    setCustomFormulas(prev => {
                        const newFormulas = [...prev];
                        let count = 0;
                        imported.forEach(imp => {
                            if (!newFormulas.some(f => f.targetCol === imp.targetCol && f.expression === imp.expression)) {
                                newFormulas.push(imp);
                                count++;
                            }
                        });
                        newFormulasCount += count;
                        return newFormulas;
                    });
                    totalImported += imported.length;
                } else {
                    skippedFiles.push(`${file.name} (Không có dữ liệu hàng)`);
                }
            } catch (err) {
                console.error(`Lỗi khi đọc file ${file.name}:`, err);
                skippedFiles.push(`${file.name} (Lỗi đọc file)`);
            }
        }

        if (totalImported > 0) {
            let msg = `Đã trích xuất thành công ${totalImported} công thức! (Thêm mới: ${newFormulasCount})`;
            if (skippedFiles.length > 0) {
                msg += `\n\nLưu ý các file bị bỏ qua:\n- ${skippedFiles.join('\n- ')}`;
            }
            alert(msg);
            setImportFiles([]);
            setIsImportModalOpen(false);
        } else {
            alert(`Không tìm thấy dữ liệu công thức hợp lệ.\n\nChi tiết:\n- ${skippedFiles.join('\n- ')}`);
        }
    };

    // Hàm parse dành riêng cho Sandbox: giữ nguyên chuỗi text thay vì trả null
    // (Khác với parseNumSafe trong formatters.js dành cho so sánh số)
    const parseValForSandbox = (val) => {
        if (val === undefined || val === null) return val;
        let sVal = String(val).trim();
        let cleanNum = sVal.replace(/[\(\)\-]/g, '');
        const commaCount = (cleanNum.match(/,/g) || []).length;
        const dotCount = (cleanNum.match(/\./g) || []).length;
        if (commaCount > 0 && dotCount > 0) {
            cleanNum = cleanNum.lastIndexOf(',') > cleanNum.lastIndexOf('.') ? cleanNum.replace(/\./g, '').replace(',', '.') : cleanNum.replace(/,/g, '');
        } else if (commaCount > 1) { cleanNum = cleanNum.replace(/,/g, ''); }
        else if (commaCount === 1) { cleanNum = cleanNum.replace(',', '.'); }
        else if (dotCount > 1) { cleanNum = cleanNum.replace(/\./g, ''); }

        if (sVal === '') return '';
        if (/[a-zA-Z]/.test(sVal) || (sVal.startsWith('0') && sVal.length > 1 && !sVal.includes('.'))) {
            return sVal;
        } else if (!isNaN(cleanNum.replace(/\s+/g, ''))) {
            const isNegative = sVal.startsWith('-') || (sVal.startsWith('(') && sVal.endsWith(')'));
            return isNegative ? -parseFloat(cleanNum.replace(/\s+/g, '')) : parseFloat(cleanNum.replace(/\s+/g, ''));
        }
        return sVal;
    };

    const handleTestFormulaLoad = () => {
        if (!results) {
            alert("Vui lòng chạy 'Bắt đầu Đối soát' ở Bước 3 trước khi sử dụng Sandbox kiểm tra.");
            return;
        }
        if (!testEmpId || testFormulaIdx < 0 || !customFormulas[testFormulaIdx]) return;
        
        const empRow = results.find(r => String(r[keyCol]) === String(testEmpId).trim());
        if (empRow) {
            setTestEmpFound(true);
            const formulaObj = customFormulas[testFormulaIdx];
            
            const actualTargetCol = Object.keys(empRow.baseVals).find(k => 
                normalizeHeader(extractCleanName(k)) === normalizeHeader(extractCleanName(formulaObj.targetCol))
            ) || formulaObj.targetCol;
            const rawTarget = empRow.baseVals[actualTargetCol];
            
            if (rawTarget !== undefined) {
                setTestTargetVal(parseValForSandbox(rawTarget));
            } else {
                setTestTargetVal("Không tìm thấy trong File Gốc");
            }

            const targetFileId = targetFiles[0]?.id;
            const newVars = {};
            
            const varsList = extractVariables(formulaObj.expression);
            
            varsList.forEach(colName => {
                const actualBaseCol = Object.keys(empRow.baseVals).find(k => 
                    normalizeHeader(extractCleanName(k)) === normalizeHeader(extractCleanName(colName))
                ) || colName;
                
                let val = ""; 
                if (targetFileId && empRow.targetVals[targetFileId]) {
                    const actualTargetColTf = Object.keys(empRow.targetVals[targetFileId]).find(k => 
                        normalizeHeader(extractCleanName(k)) === normalizeHeader(extractCleanName(colName))
                    ) || colName;
                    if (empRow.targetVals[targetFileId][actualTargetColTf] !== undefined && empRow.targetVals[targetFileId][actualTargetColTf] !== ' Bỏ qua/Thiếu') {
                        val = empRow.targetVals[targetFileId][actualTargetColTf];
                    } else if (empRow.baseVals[actualBaseCol] !== undefined) {
                        val = empRow.baseVals[actualBaseCol];
                    }
                } else if (empRow.baseVals[actualBaseCol] !== undefined) {
                    val = empRow.baseVals[actualBaseCol];
                }
                newVars[colName] = val;
            });

            setTestVariables(newVars);
            setTestResult(null); 
            setIsCalculated(false);
            setCalcLogs([]); 
        } else {
            setTestEmpFound(false);
            alert(`Không tìm thấy ${keyCol}: ${testEmpId}`);
        }
    };

    const handleCalculateSandboxFormula = () => {
        if (testFormulaIdx < 0 || !customFormulas[testFormulaIdx]) return;
        const formulaObj = customFormulas[testFormulaIdx];
        const { result, logs } = evaluateFormula(formulaObj.expression, testVariables, showConsole);
        
        setTestResult(result);
        setIsCalculated(true);
        setCalcLogs(logs || []);
    };

    return {
        formulaTab, setFormulaTab,
        newFormulaTarget, setNewFormulaTarget,
        newFormulaExpr, setNewFormulaExpr,
        previewVariables, setPreviewVariables,
        hasPreviewed, setHasPreviewed,
        editingFormulaIdx, setEditingFormulaIdx,
        importFormulaRef,
        handlePreviewFormula,
        handleImportFormulas,
        
        testEmpId, setTestEmpId,
        testFormulaIdx, setTestFormulaIdx,
        isSandboxComboOpen, setIsSandboxComboOpen,
        sandboxSearch, setSandboxSearch,
        sandboxComboRef,
        testEmpFound, setTestEmpFound,
        testVariables, setTestVariables,
        showConsole, setShowConsole,
        isCalculated, setIsCalculated,
        testResult, setTestResult,
        testTargetVal, setTestTargetVal,
        calcLogs, setCalcLogs,
        
        isImportModalOpen, setIsImportModalOpen,
        importFiles, setImportFiles,
        handleExtractFormulas,
        formulaSearch, setFormulaSearch,

        handleTestFormulaLoad,
        handleCalculateSandboxFormula
    };
}
