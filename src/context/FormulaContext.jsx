import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { extractVariables, evaluateFormula } from '../utils/astCompiler';
import { normalizeHeader } from '../utils/excelUtils';
import { useComparison } from './ComparisonContext';

const FormulaContext = createContext();

export const FormulaProvider = ({ children }) => {
  const [formulaTab, setFormulaTab] = useState('define');
  const [newFormulaTarget, setNewFormulaTarget] = useState('');
  const [newFormulaExpr, setNewFormulaExpr] = useState('');
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [previewVariables, setPreviewVariables] = useState([]);
  const [editingFormulaIdx, setEditingFormulaIdx] = useState(-1);
  const [formulaSearch, setFormulaSearch] = useState('');
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  
  // Persistence Logic: Load from localStorage on init
  const [customFormulas, setCustomFormulas] = useState(() => {
    const saved = localStorage.getItem('ihrp_formulas');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage whenever formulas change
  useEffect(() => {
    localStorage.setItem('ihrp_formulas', JSON.stringify(customFormulas));
  }, [customFormulas]);

  const [testEmpId, setTestEmpId] = useState('');
  const [testFormulaIdx, setTestFormulaIdx] = useState(-1);
  const [isSandboxComboOpen, setIsSandboxComboOpen] = useState(false);
  const [sandboxSearch, setSandboxSearch] = useState('');
  const sandboxComboRef = useRef(null);
  const [testEmpFound, setTestEmpFound] = useState(false);
  const [testVariables, setTestVariables] = useState({});
  const [testTargetVal, setTestTargetVal] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isCalculated, setIsCalculated] = useState(false);
  const [calcLogs, setCalcLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);

  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [graphViewFormula, setGraphViewFormula] = useState(null);
  const [isChainOpen, setIsChainOpen] = useState(false);
  const [chainViewFormula, setChainViewFormula] = useState(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const importFormulaRef = useRef(null);

  // Global results for simulation context - can be synced from ComparisonContext
  const { results: comparisonResults, targetFiles, keyCol } = useComparison();

  // Helper for sandbox value parsing
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

  const handlePreviewFormula = () => {
    if (!newFormulaExpr.trim()) {
      alert("Vui lòng nhập công thức tính toán để kiểm tra.");
      return;
    }
    const vars = extractVariables(newFormulaExpr);
    setPreviewVariables(vars);
    setHasPreviewed(true);
  };

  const handleTestFormulaLoad = () => {
    const activeResults = comparisonResults || [];
    if (activeResults.length === 0) {
      alert("Vui lòng chạy 'Bắt đầu Đối soát' ở Bước 3 trước khi sử dụng Sandbox kiểm tra.");
      return;
    }
    if (!testEmpId || testFormulaIdx < 0 || !customFormulas[testFormulaIdx]) return;
    
    const empRow = activeResults.find(r => String(r[keyCol]) === String(testEmpId).trim());
    if (empRow) {
      setTestEmpFound(true);
      const formulaObj = customFormulas[testFormulaIdx];
      
      const actualTargetCol = Object.keys(empRow.baseVals).find(k => normalizeHeader(k) === normalizeHeader(formulaObj.targetCol)) || formulaObj.targetCol;
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
        const actualBaseCol = Object.keys(empRow.baseVals).find(k => normalizeHeader(k) === normalizeHeader(colName)) || colName;
        
        let val = ""; 
        if (targetFileId && empRow.targetVals[targetFileId]) {
          const actualTargetColTf = Object.keys(empRow.targetVals[targetFileId]).find(k => normalizeHeader(k) === normalizeHeader(colName)) || colName;
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

  return (
    <FormulaContext.Provider value={{
      formulaTab, setFormulaTab,
      newFormulaTarget, setNewFormulaTarget,
      newFormulaExpr, setNewFormulaExpr,
      hasPreviewed, setHasPreviewed,
      previewVariables, setPreviewVariables,
      editingFormulaIdx, setEditingFormulaIdx,
      customFormulas, setCustomFormulas,
      formulaSearch, setFormulaSearch,
      selectedIndices, setSelectedIndices,
      testEmpId, setTestEmpId,
      testFormulaIdx, setTestFormulaIdx,
      isSandboxComboOpen, setIsSandboxComboOpen,
      sandboxSearch, setSandboxSearch,
      sandboxComboRef,
      testEmpFound, setTestEmpFound,
      testVariables, setTestVariables,
      testTargetVal, setTestTargetVal,
      testResult, setTestResult,
      isCalculated, setIsCalculated,
      calcLogs, setCalcLogs,
      showConsole, setShowConsole,
      isGraphOpen, setIsGraphOpen,
      graphViewFormula, setGraphViewFormula,
      isChainOpen, setIsChainOpen,
      chainViewFormula, setChainViewFormula,
      isImportModalOpen, setIsImportModalOpen,
      importFiles, setImportFiles,
      importFormulaRef,
      results: comparisonResults,
      handlePreviewFormula,
      handleTestFormulaLoad,
      handleCalculateSandboxFormula
    }}>
      {children}
    </FormulaContext.Provider>
  );
};

export const useFormula = () => useContext(FormulaContext);
