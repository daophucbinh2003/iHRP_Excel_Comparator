import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelColumnFilter from './ExcelColumnFilter';
import SearchableSelect from './SearchableSelect';
import { parseNumSafe } from './formatters';
import { tokenizeSQL, extractVariables, evaluateFormula } from './astCompiler';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import './index.css';

import CompareWorker from './compareWorker?worker';

// MẸO: Gán XLSX vào window để bạn không phải đi sửa các dòng code cũ đang gọi `window.XLSX`
window.XLSX = XLSX;

function App() {
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  
  // App Workflow Steps
  const [currentStep, setCurrentStep] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [baseFile, setBaseFile] = useState(null); 
  const [targetFiles, setTargetFiles] = useState([]); 

  const [availableCols, setAvailableCols] = useState([]);
  const [keyCol, setKeyCol] = useState('');
  const [valCols, setValCols] = useState([]);

  // Advanced Comparison Options
  const [advancedRules, setAdvancedRules] = useState({});
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advSelectedCol, setAdvSelectedCol] = useState(''); 
  const [advSearchCol, setAdvSearchCol] = useState(''); 
  const [isAdvComboOpen, setIsAdvComboOpen] = useState(false); 

  // --- FORMULA ASSISTANT STATES ---
  const [previousStep, setPreviousStep] = useState(1);
  const [formulaTab, setFormulaTab] = useState('define'); // 'define' or 'sandbox'
  const [customFormulas, setCustomFormulas] = useState([]); // { targetCol: '', expression: '' }
  const [newFormulaTarget, setNewFormulaTarget] = useState('');
  const [newFormulaExpr, setNewFormulaExpr] = useState('');
  const [previewVariables, setPreviewVariables] = useState([]); // Chứa danh sách tiêu chí tạm thời
  const [hasPreviewed, setHasPreviewed] = useState(false); // Đánh dấu đã ấn kiểm tra ở Tab 1 chưa
  const [editingFormulaIdx, setEditingFormulaIdx] = useState(-1); // Trạng thái đang chỉnh sửa
  
  const [testEmpId, setTestEmpId] = useState('');
  const [testFormulaIdx, setTestFormulaIdx] = useState(-1);
  const [testVariables, setTestVariables] = useState({});
  const [testResult, setTestResult] = useState(null); // null means not calculated yet
  const [isCalculated, setIsCalculated] = useState(false); // Kiểm soát trạng thái hiển thị kết quả
  const [testTargetVal, setTestTargetVal] = useState(null);
  const [testEmpFound, setTestEmpFound] = useState(false);
  const [selectedEmpIdForTest, setSelectedEmpIdForTest] = useState(''); 

  const [sandboxSearch, setSandboxSearch] = useState('');
  const [isSandboxComboOpen, setIsSandboxComboOpen] = useState(false);
  const sandboxComboRef = useRef(null);

  // LOGS CONSOLE STATE
  const [showConsole, setShowConsole] = useState(false);
  const [calcLogs, setCalcLogs] = useState([]);

  const importFormulaRef = useRef(null);

  useEffect(() => {
      const saved = localStorage.getItem('ihrp_custom_formulas');
      if (saved) {
          try { setCustomFormulas(JSON.parse(saved)); } catch(e){}
      }
  }, []);

  useEffect(() => {
      localStorage.setItem('ihrp_custom_formulas', JSON.stringify(customFormulas));
  }, [customFormulas]);

  // Visibility Selection for Step 4
  const [displayCols, setDisplayCols] = useState([]);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef(null);
  const [colDisplaySearch, setColDisplaySearch] = useState('');
  const [colMenuStyle, setColMenuStyle] = useState({});

  const [keySearchText, setKeySearchText] = useState('');
  const [isKeyDropdownOpen, setIsKeyDropdownOpen] = useState(false);
  const keyDropdownRef = useRef(null);

  const [columnMappings, setColumnMappings] = useState({});
  const [showMapped, setShowMapped] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [results, setResults] = useState(null);
  
  // Filter States
  const [globalFilter, setGlobalFilter] = useState('all'); 
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [excelFilters, setExcelFilters] = useState({});
  const [mappingFilters, setMappingFilters] = useState({}); 

  // Add Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [globalFilter, excelFilters, globalSearchText]);

  const [isDraggingBase, setIsDraggingBase] = useState(false);
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');

  const baseInputRef = useRef(null);
  const targetInputRef = useRef(null);
  const advComboRef = useRef(null); 

  const diffNavTracker = useRef({});

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Theme Object
  const themeUI = {
    appBg: isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f8f9fc]',
    cardBg: isDarkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-gray-200',
    headerBg: isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-gray-200',
    textMain: isDarkMode ? 'text-slate-200' : 'text-gray-800',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-gray-500',
    textTitle: isDarkMode ? 'text-slate-100' : 'text-gray-900',
    inputBg: isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    innerBox: isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-gray-50 border-gray-200',
    tableHead: isDarkMode ? 'bg-[#0f172a] text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-gray-300',
    tableRow: isDarkMode ? 'hover:bg-slate-800/50 border-slate-700' : 'hover:bg-blue-50/50 border-gray-200',
    tableCellBg: isDarkMode ? 'bg-[#1e293b]' : 'bg-white',
    tdHover: isDarkMode ? 'hover:bg-slate-600/50' : 'hover:bg-blue-100/50',
    inputLine: isDarkMode ? 'border-purple-500 focus:border-purple-300 text-purple-200 bg-transparent' : 'border-purple-300 focus:border-purple-600 text-purple-900 bg-transparent',
  };

  const targetColorsLight = ['bg-blue-100 text-blue-800 border-blue-200', 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', 'bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-amber-100 text-amber-800 border-amber-200', 'bg-violet-100 text-violet-800 border-violet-200'];
  const targetColorsDark = ['bg-blue-900/40 text-blue-300 border-blue-700/50', 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-700/50', 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50', 'bg-amber-900/40 text-amber-300 border-amber-700/50', 'bg-violet-900/40 text-violet-300 border-violet-700/50'];

  useEffect(() => {
    // Check if XLSX is loaded globally
    if (window.XLSX) {
       setXlsxLoaded(true);
    } else {
       const checkXlsx = setInterval(() => {
           if (window.XLSX) {
               setXlsxLoaded(true);
               clearInterval(checkXlsx);
           }
       }, 200);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (keyDropdownRef.current && !keyDropdownRef.current.contains(event.target)) {
        setIsKeyDropdownOpen(false);
        setKeySearchText(keyCol);
      }
      if (colMenuRef.current && !colMenuRef.current.contains(event.target)) {
        setShowColMenu(false);
      }
      if (advComboRef.current && !advComboRef.current.contains(event.target)) {
        setIsAdvComboOpen(false);
      }
      if (sandboxComboRef.current && !sandboxComboRef.current.contains(event.target)) {
        setIsSandboxComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [keyCol]);

  // FIX ISSUE 2: displayCols phải chứa toàn bộ cột của bảng gốc, không chỉ valCols đã chọn ở bước 3
  useEffect(() => {
    if (baseFile && baseFile.headers) {
      setDisplayCols([...baseFile.headers]);
    }
  }, [baseFile]);

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
        setTimeout(() => setToastMessage(''), 2000);
    } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(textArea);
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

  const isSTT = (colName) => {
    const lower = String(colName).toLowerCase().trim();
    return lower === 'stt' || lower === 'số thứ tự' || lower === 'so thu tu';
  };

  const getAutoCompareColumns = (headers, keyColumn) => {
    if (!Array.isArray(headers)) return [];
    return headers.filter(col => col !== keyColumn && !isSTT(col));
  };


  // --- LOGIC QUÉT HEADER TỐI ƯU ---
  const getSheetHeaderInfo = (wb, sheetName) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return { headers: [], headerRowIdx: 0 };
    const range = window.XLSX.utils.decode_range(sheet['!ref']);
    
    let headerRowIdx = -1;
    const maxScanRow = Math.min(range.e.r, range.s.r + 20); 
    let bestRowIdx = range.s.r;
    
    for (let R = range.s.r; R <= maxScanRow; ++R) {
      let hasKeyWord = false;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[window.XLSX.utils.encode_cell({ c: C, r: R })];
        if (cell && cell.v !== undefined && cell.v !== null) {
          const text = String(cell.v).trim().toLowerCase();
          if (text.includes('mã') && (text.includes('nhân viên') || text.includes('nv'))) {
            hasKeyWord = true; break;
          }
        }
      }
      if (hasKeyWord) { headerRowIdx = R; break; }
    }

    if (headerRowIdx === -1) {
      for (let R = range.s.r; R <= maxScanRow; ++R) {
        let hasSTT = false;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = sheet[window.XLSX.utils.encode_cell({ c: C, r: R })];
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

    if (headerRowIdx === -1) {
      let maxCols = 0;
      for (let R = range.s.r; R <= maxScanRow; ++R) {
        let colCount = 0;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = sheet[window.XLSX.utils.encode_cell({ c: C, r: R })];
          if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') colCount++;
        }
        if (colCount > maxCols) { maxCols = colCount; bestRowIdx = R; }
      }
      headerRowIdx = bestRowIdx;
    }

    const headers = [];
    const seen = {};
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[window.XLSX.utils.encode_cell({ c: C, r: headerRowIdx })];
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
      const workbook = window.XLSX.read(data, { type: 'array', cellFormula: true });
      const sheetName = workbook.SheetNames[0];
      const { headers, headerRowIdx } = getSheetHeaderInfo(workbook, sheetName);
      return { name: file.name, customName: file.name, wb: workbook, sheet: sheetName, headers, headerRowIdx };
    } catch (err) {
      alert(`Không thể đọc file "${file.name}".\nVui lòng kiểm tra lại định dạng file (.xlsx hoặc .xls).\n\nChi tiết lỗi: ${err.message}`);
      return null;
    }
  };

  const handleBaseUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const processed = await processExcelFile(file);
    if (!processed) return; // file hỏng
    setBaseFile(processed);
    e.target.value = null;
  };

  const handleBaseDrop = async (e) => {
    e.preventDefault();
    setIsDraggingBase(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const processed = await processExcelFile(file);
    if (!processed) return;
    setBaseFile(processed);
  };

  const handleTargetUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newTargets = [];
    for (const file of files) {
      const processed = await processExcelFile(file);
      if (!processed) continue; // bỏ qua file hỏng
      processed.id = Date.now() + Math.random(); 
      newTargets.push(processed);
    }
    if (newTargets.length > 0) setTargetFiles(prev => [...prev, ...newTargets]);
    e.target.value = null; 
  };

  const handleTargetDrop = async (e) => {
    e.preventDefault();
    setIsDraggingTarget(false);
    const files = Array.from(e.dataTransfer.files);
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

  useEffect(() => {
    if (baseFile) {
      const baseHeaders = baseFile.headers;
      setAvailableCols(baseHeaders);
      if (baseHeaders.length > 0 && !baseHeaders.includes(keyCol)) {
        setKeyCol(baseHeaders[0]);
      }
    } else {
      setAvailableCols([]);
      setValCols([]);
    }
  }, [baseFile]);

  useEffect(() => {
    setValCols(getAutoCompareColumns(availableCols, keyCol));
  }, [availableCols, keyCol]);

  useEffect(() => {
    if (baseFile && targetFiles.length > 0) {
      setColumnMappings(prev => {
        const newMap = { ...prev };
        let updated = false;
        targetFiles.forEach(tf => {
          if (!newMap[tf.id]) {
            newMap[tf.id] = {};
            updated = true;
          }
          baseFile.headers.forEach(bCol => {
            if (newMap[tf.id][bCol] === undefined) {
              newMap[tf.id][bCol] = tf.headers.includes(bCol) ? bCol : '';
              updated = true;
            }
          });
        });
        return updated ? newMap : prev;
      });
    }
  }, [baseFile, targetFiles]);

  const checkStructureAndProceed = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setCurrentStep(2);
    }, 200);
  };

  const runMultiComparison = () => {
    const compareColumns = getAutoCompareColumns(availableCols, keyCol);
    if (!keyCol || compareColumns.length === 0) {
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
                setCurrentStep(4);
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
            compareColumns,
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

  const missingKeyTargets = targetFiles.filter(tf => !columnMappings[tf.id]?.[keyCol]);

  const getMappingUnique = (colKey) => {
    if (!baseFile) return [];
    if (colKey === 'base') return baseFile.headers;
    return []; 
  };

  const mappingColsToShow = baseFile ? baseFile.headers.filter(bCol => {
    if (!showMapped) {
      const needsMapping = targetFiles.some(tf => !tf.headers.includes(bCol));
      if (!needsMapping) return false;
    }
    const allowedVals = mappingFilters['base'];
    if (allowedVals && !allowedVals.includes(bCol)) return false;
    return true;
  }) : [];

  const activeValCols = valCols.filter(c => displayCols.includes(c));

  const rowMatchesCurrentView = (row, excludeFilterKey = null) => {
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
    }

    if (globalFilter === 'match') {
        if (row.isMissing || hasVisibleDiff) return false;
    }

    if (globalSearchText) {
      const rowString = JSON.stringify(row).toLowerCase();
      if (!rowString.includes(globalSearchText.toLowerCase())) return false;
    }

    for (const [cKey, allowedVals] of Object.entries(excelFilters)) {
      if (!allowedVals || cKey === excludeFilterKey) continue;
      let rowVals = [];
      if (cKey === `V_${keyCol}`) {
        rowVals = [String(row[keyCol])];
      } else {
        const actualCol = cKey.substring(2);
        const bVal = row.baseVals[actualCol];
        if (bVal !== undefined) rowVals.push(String(bVal));

        targetFiles.forEach(tf => {
          const tVal = row.targetVals[tf.id]?.[actualCol];
          if (tVal !== undefined && tVal !== ' Bỏ qua/Thiếu') rowVals.push(String(tVal));
        });
      }

      if (!rowVals.some(v => allowedVals.includes(String(v)))) return false;
    }

    return true;
  };

  // TỐI ƯU HÓA: Chỉ tính toán lại danh sách đã lọc khi bộ lọc hoặc dữ liệu gốc thay đổi
  const filteredResults = React.useMemo(() => {
    return results ? results.filter(row => rowMatchesCurrentView(row)) : [];
  }, [results, globalFilter, globalSearchText, excelFilters, targetFiles, activeValCols]);

  const getUniqueValues = (cKey) => {
    if (!results) return [];
    const vals = new Set();

    results
      .filter(r => rowMatchesCurrentView(r, cKey))
      .forEach(r => {
        if (cKey === `V_${keyCol}`) {
          vals.add(String(r[keyCol]));
          return;
        }
        if (cKey === 'V_status') {
          r.status.forEach(s => vals.add(s));
          return;
        }

        const actualCol = cKey.substring(2);
        const bVal = r.baseVals[actualCol];
        if (bVal !== undefined) vals.add(String(bVal));

        targetFiles.forEach(tf => {
          const tVal = r.targetVals[tf.id]?.[actualCol];
          if (tVal !== undefined && tVal !== ' Bỏ qua/Thiếu') vals.add(String(tVal));
        });
      });

    return Array.from(vals).sort((a, b) => String(a).localeCompare(String(b), 'vi'));
  };

  // TỐI ƯU HÓA: Chỉ tính toán lại thống kê tổng quan khi mảng results thay đổi
  const overviewStats = React.useMemo(() => {
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
                      hasVisibleDiff = true; break;
                  }
              }
              if (hasVisibleDiff) dynamicDiffCount++;
              else dynamicMatchCount++;
          });
      }
      return results ? { total: results.length, match: dynamicMatchCount, diff: dynamicDiffCount, missing: missingCount } : { total: 0, match: 0, diff: 0, missing: 0 };
  }, [results, activeValCols, targetFiles]);

  const visibleValCols = activeValCols;

  const displayedValCols = valCols.filter(c => c.toLowerCase().includes(colDisplaySearch.toLowerCase()));
  const isAllValDisplayed = displayedValCols.length > 0 && displayedValCols.every(c => displayCols.includes(c));
  
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

        visibleValCols.forEach(col => {
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
            
            visibleValCols.forEach(col => {
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
            visibleValCols.forEach(col => {
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
        setTimeout(() => setToastMessage(''), 3000);
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
  const handleLastPage = () => { setCurrentPage(totalPages); };

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

  const renderStackedCell = (row, colKey) => {
    const baseKey = colKey;
    const baseVal = row.baseVals[baseKey];
    const strBaseVal = baseVal !== undefined ? String(baseVal) : '-';
    const hasAnyDiff = targetFiles.some(tf => row.diffCells[`${colKey}_${tf.id}`]);

    // Khi filter = 'diff': ô không có diff hiển thị dấu gạch mờ
    if (!hasAnyDiff && !row.isMissing && globalFilter === 'diff') {
        return <span className={`block w-full text-center font-bold opacity-30 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>-</span>;
    }

    // Khi filter = 'all' hoặc 'match' với ô không có diff và không thiếu: hiển thị đơn giản
    if (!hasAnyDiff && !row.isMissing && globalFilter !== 'match') {
        return <span className={`font-medium cursor-pointer break-words whitespace-pre-wrap flex-1 min-w-0 ${themeUI.tdHover} p-0.5 rounded transition-colors inline-block w-full h-full`} onClick={() => handleCopy(strBaseVal)} title="Click để Copy">{strBaseVal}</span>;
    }

    return (
        <div className="flex flex-col gap-1.5 min-w-0 w-full h-full">
            {row.baseVals[keyCol] && (
                <div className="flex items-start gap-1.5 w-full">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0 mt-0.5 uppercase tracking-wide max-w-[80px] truncate ${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-gray-200 text-gray-700 border-gray-300'}`} title={baseFile?.customName || 'GỐC'}>
                      {baseFile?.customName || 'GỐC'}
                    </span>
                    <span className={`break-words whitespace-pre-wrap font-medium flex-1 min-w-0 cursor-pointer ${themeUI.tdHover} p-0.5 rounded transition-colors inline-block w-full ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`} onClick={() => handleCopy(strBaseVal)} title="Click để Copy">{strBaseVal}</span>
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

                const colorClass = isDarkMode ? targetColorsDark[i % targetColorsDark.length] : targetColorsLight[i % targetColorsLight.length];

                return (
                    <div key={tf.id} className="flex items-start gap-1.5 w-full">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0 truncate max-w-[80px] mt-0.5 uppercase tracking-wide ${colorClass}`} title={tf.customName || tf.name}>
                            {tf.customName || tf.name}
                        </span>
                        <span className={`break-words whitespace-pre-wrap font-medium flex-1 min-w-0 w-full ${isDiff ? (isDarkMode ? 'text-red-400 font-bold' : 'text-red-600 font-bold') : (isDarkMode ? 'text-gray-400' : 'text-gray-600')} ${isMissingCol ? 'italic opacity-70' : ''}`}>
                            {tfData._error ? <span className="text-red-500 italic text-xs">{tfData._error}</span> : <span className={`cursor-pointer ${themeUI.tdHover} p-0.5 rounded transition-colors inline-block w-full`} onClick={() => handleCopy(strVal)} title="Click để Copy">{strVal}</span>}
                        </span>
                    </div>
                );
            })}
        </div>
    );
  }

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
      if (!results) {
          alert("Vui lòng chạy 'Bắt đầu Đối soát' ở Bước 3 trước khi sử dụng Sandbox kiểm tra.");
          return;
      }
      if (!testEmpId || testFormulaIdx < 0 || !customFormulas[testFormulaIdx]) return;
      
      const empRow = results.find(r => String(r[keyCol]) === String(testEmpId).trim());
      if (empRow) {
          setTestEmpFound(true);
          const formulaObj = customFormulas[testFormulaIdx];
          
          const actualTargetCol = Object.keys(empRow.baseVals).find(k => k.toLowerCase() === formulaObj.targetCol.toLowerCase()) || formulaObj.targetCol;
          const rawTarget = empRow.baseVals[actualTargetCol];
          
          if (rawTarget !== undefined) {
              setTestTargetVal(parseNumSafe(rawTarget));
          } else {
              setTestTargetVal("Không tìm thấy trong File Gốc");
          }

          const targetFileId = targetFiles[0]?.id;
          const newVars = {};
          
          const varsList = extractVariables(formulaObj.expression);
          
          varsList.forEach(colName => {
              const actualBaseCol = Object.keys(empRow.baseVals).find(k => k.toLowerCase() === colName.toLowerCase()) || colName;
              
              let val = ""; 
              if (targetFileId && empRow.targetVals[targetFileId]) {
                  const actualTargetColTf = Object.keys(empRow.targetVals[targetFileId]).find(k => k.toLowerCase() === colName.toLowerCase()) || colName;
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
          setToastMessage(`Không tìm thấy ${keyCol}: ${testEmpId}`);
          setTimeout(() => setToastMessage(''), 3000);
      }
  };

  const handleImportFormulas = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
          const data = await file.arrayBuffer();
          const wb = window.XLSX.read(data, { type: 'array' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          if (jsonData.length < 2) {
              alert("File quá ngắn hoặc trống."); return;
          }
          
          const headerRow = jsonData[0] || [];
          let targetIdx = -1;
          let exprIdx = -1;

          headerRow.forEach((h, idx) => {
              const str = String(h).toLowerCase().trim();
              if (str.includes('mã tiêu chí') || str.includes('cột đích') || str === 'target') targetIdx = idx;
              if (str.includes('công thức') || str === 'formula') exprIdx = idx;
          });

          if (targetIdx === -1 || exprIdx === -1) {
              alert("Không tìm thấy cột 'Mã tiêu chí' và 'Công thức' ở dòng đầu tiên của file.");
              return;
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
                  imported.forEach(imp => {
                      if (!newFormulas.some(f => f.targetCol === imp.targetCol && f.expression === imp.expression)) {
                          newFormulas.push(imp);
                      }
                  });
                  return newFormulas;
              });
              setToastMessage(`Đã import thành công ${imported.length} công thức!`);
              setTimeout(() => setToastMessage(''), 3000);
          } else {
              alert("Không tìm thấy dữ liệu công thức hợp lệ trong file.");
          }
      } catch (err) {
          alert("Có lỗi khi đọc file Excel.");
      }
      e.target.value = null; 
  };

  let stepTitle = '';
  let stepDesc = '';
  let backAction = null;

  if (currentStep === 1) {
      stepTitle = 'Bước 1: Tải Lên Tập Tin Dữ Liệu';
      stepDesc = 'Cung cấp File gốc và các File cần đối chiếu.';
  } else if (currentStep === 2) {
      stepTitle = 'Bước 2: Bảng Gán Cột (Mapping)';
      stepDesc = 'Tìm kiếm và gán các cột không trùng tên giữa File gốc và các File so sánh.';
      backAction = () => setCurrentStep(1);
  } else if (currentStep === 3) {
      stepTitle = 'Bước 3: Cấu Hình Quy Tắc So Sánh';
      stepDesc = 'Chỉ định tiêu chí kiểm tra dữ liệu (Cột Key, Giá trị).';
      backAction = () => setCurrentStep(2);
  } else if (currentStep === 'rename') {
      stepTitle = 'Đổi Tên Hiển Thị Của Bảng';
      stepDesc = 'Đặt tên ngắn gọn, dễ nhớ cho các file để tiện quan sát khi đối soát.';
      backAction = () => setCurrentStep(3);
  } else if (currentStep === 4) {
      stepTitle = 'Bước 4: Bảng Đối Soát Chi Tiết';
      stepDesc = 'Chi tiết các dòng dữ liệu có sự sai lệch hoặc thiếu sót.';
      backAction = () => setCurrentStep(3);
  } else if (currentStep === 'formula') {
      stepTitle = 'Trợ Lý Cấu Hình & Kiểm Tra Công Thức';
      stepDesc = 'Quản lý, tạo mới và mô phỏng các công thức tính toán tùy chỉnh.';
      backAction = () => setCurrentStep(previousStep);
  }

  if (!xlsxLoaded) {
    return <div className="flex h-screen items-center justify-center bg-gray-100 text-lg font-semibold text-gray-500">Đang tải hệ thống...</div>;
  }

  const filteredAdvCols = [...valCols].filter(c => c.toLowerCase().includes(advSearchCol.toLowerCase()));

  return (
    <div className={`flex flex-col h-screen overflow-hidden text-[13px] transition-colors ${themeUI.appBg} ${isDarkMode ? 'dark' : ''}`}>
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
         <div className="fixed bottom-6 right-6 z-[999999] bg-green-600 text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in border border-green-500">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            <span className="font-medium text-sm">{toastMessage}</span>
         </div>
      )}

      {/* ADVANCED OPTIONS MODAL */}
      {showAdvancedOptions && (
        <div className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[75vh] min-h-[500px] overflow-hidden ${themeUI.cardBg}`}>
            <div className={`p-4 border-b flex justify-between items-center ${themeUI.border} ${themeUI.headerBg}`}>
              <h3 className={`text-lg font-bold flex items-center ${themeUI.textTitle}`}>
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                Lựa Chọn So Sánh Nâng Cao
              </h3>
              <button onClick={() => setShowAdvancedOptions(false)} className={`${themeUI.textMuted} hover:text-red-500 transition-colors`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className={`p-5 overflow-y-auto flex-1 flex flex-col gap-6 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
              <div>
                  <label className={`font-bold text-sm mb-2 block ${themeUI.textTitle}`}>1. Chọn cột cần cấu hình</label>
                  
                  <div className="relative" ref={advComboRef}>
                      <div 
                          onClick={() => setIsAdvComboOpen(!isAdvComboOpen)}
                          className={`w-full p-3 border rounded-lg cursor-pointer flex justify-between items-center font-bold ${themeUI.inputBg} ${isAdvComboOpen ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-300 dark:border-slate-600'}`}
                      >
                          <span className={advSelectedCol ? "" : "opacity-50 font-normal"}>{advSelectedCol || "-- Bấm để chọn cột cần cấu hình --"}</span>
                          <svg className={`w-5 h-5 transition-transform ${isAdvComboOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                      
                      {isAdvComboOpen && (
                          <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-gray-300'}`}>
                              <div className="p-2 border-b dark:border-slate-700">
                                  <input 
                                      type="text" 
                                      placeholder=" Nhập tên cột để tìm..." 
                                      value={advSearchCol} 
                                      onChange={(e) => setAdvSearchCol(e.target.value)} 
                                      className={`w-full p-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${themeUI.inputBg}`} 
                                      autoFocus
                                  />
                              </div>
                              <ul className={`max-h-60 overflow-y-auto p-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                                  {filteredAdvCols.map(c => (
                                      <li 
                                          key={`adv-opt-${c}`} 
                                          onClick={() => { setAdvSelectedCol(c); setIsAdvComboOpen(false); setAdvSearchCol(''); }}
                                          className={`p-2.5 rounded cursor-pointer text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-blue-50 text-gray-800'} ${advSelectedCol === c ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800') : ''}`}
                                      >
                                          {c}
                                      </li>
                                  ))}
                                  {filteredAdvCols.length === 0 && <li className="p-3 text-center text-gray-500 text-xs italic">Không tìm thấy cột nào</li>}
                              </ul>
                          </div>
                      )}
                  </div>
              </div>

              {advSelectedCol && (
                  <div className={`p-4 border rounded-xl shadow-inner ${isDarkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-blue-50/30 border-blue-100'}`}>
                      <div className="flex justify-between items-center mb-4">
                          <label className={`font-bold text-sm block ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>2. Thiết lập quy tắc cho cột "{advSelectedCol}"</label>
                      </div>

                      <div className="flex flex-col gap-4">
                          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${advancedRules[advSelectedCol]?.partialMatch ? (isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-300') : (isDarkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}>
                              <input
                                  type="checkbox"
                                  className="mt-1 accent-blue-600 w-4 h-4 cursor-pointer"
                                  checked={advancedRules[advSelectedCol]?.partialMatch || false}
                                  onChange={(e) => {
                                      setAdvancedRules({
                                          ...advancedRules,
                                          [advSelectedCol]: {
                                              ...advancedRules[advSelectedCol],
                                              partialMatch: e.target.checked
                                          }
                                      })
                                  }}
                              />
                              <div>
                                  <span className={`font-bold block ${themeUI.textMain}`}>Khớp một phần</span>
                                  <p className={`text-xs mt-1 ${themeUI.textMuted}`}>Dùng cho dữ liệu chữ. Nếu một chuỗi nằm trong chuỗi còn lại thì coi là khớp.</p>
                              </div>
                          </label>

                          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${advancedRules[advSelectedCol]?.roundNumber ? (isDarkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-300') : (isDarkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}>
                              <input
                                  type="checkbox"
                                  className="mt-1 accent-purple-600 w-4 h-4 cursor-pointer"
                                  checked={advancedRules[advSelectedCol]?.roundNumber || false}
                                  onChange={(e) => {
                                      setAdvancedRules({
                                          ...advancedRules,
                                          [advSelectedCol]: {
                                              ...advancedRules[advSelectedCol],
                                              roundNumber: e.target.checked
                                          }
                                      })
                                  }}
                              />
                              <div className="w-full">
                                      <span className={`font-bold block ${themeUI.textMain}`}>Làm tròn số liệu (Round)</span>
                                      <p className={`text-xs mt-1 mb-2 ${themeUI.textMuted}`}>Dùng cho dữ liệu số. Hệ thống sẽ làm tròn và tự động sửa kết quả hiển thị của dòng đó.</p>
                                  {advancedRules[advSelectedCol]?.roundNumber && (
                                      <div className={`flex items-center gap-2.5 mt-3 p-2.5 rounded-lg border w-max transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                          <span className={`text-xs font-bold ${themeUI.textMain}`}>Làm tròn đến</span>
                                          <input
                                                  type="number"
                                              className={`w-16 p-1 text-center font-bold text-sm border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDarkMode ? 'bg-slate-700 text-white border-slate-500 focus:bg-slate-600' : 'bg-white text-gray-900 border-gray-300 focus:bg-gray-50'}`}
                                              value={advancedRules[advSelectedCol]?.decimals !== undefined ? advancedRules[advSelectedCol].decimals : 2}
                                              onChange={(e) => {
                                                      let val = e.target.value;
                                                  setAdvancedRules({
                                                      ...advancedRules,
                                                      [advSelectedCol]: {
                                                          ...advancedRules[advSelectedCol],
                                                              decimals: val === '' ? '' : parseInt(val, 10)
                                                      }
                                                  })
                                              }}
                                              onClick={(e) => e.stopPropagation()} 
                                          />
                                          <span className={`text-xs font-bold ${themeUI.textMain}`}>chữ số thập phân</span>
                                      </div>
                                  )}
                              </div>
                          </label>
                      </div>
                  </div>
              )}

              {Object.keys(advancedRules).filter(k => advancedRules[k].partialMatch || advancedRules[k].roundNumber).length > 0 && (
                  <div className="mt-2">
                      <label className={`font-bold text-xs uppercase tracking-wider mb-3 block ${themeUI.textMuted}`}>Danh sách Cột đang cấu hình ({Object.keys(advancedRules).filter(k => advancedRules[k].partialMatch || advancedRules[k].roundNumber).length}):</label>
                      <div className="flex flex-wrap gap-2">
                          {Object.keys(advancedRules).filter(k => advancedRules[k].partialMatch || advancedRules[k].roundNumber).map(k => (
                              <div key={`rule-${k}`} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-700/50 text-xs shadow-sm">
                                  <span className="font-bold max-w-[150px] truncate" title={k}>{k}</span>
                                  <span className="opacity-80 shrink-0">
                                      {advancedRules[k].partialMatch && advancedRules[k].roundNumber 
                                          ? '• Chữ & Số' 
                                          : advancedRules[k].partialMatch 
                                              ? '• Khớp chữ' 
                                              : `• Tròn ${advancedRules[k].decimals !== undefined && advancedRules[k].decimals !== '' ? advancedRules[k].decimals : 2} số`
                                      }
                                  </span>
                                  <button
                                      onClick={() => {
                                          const newRules = {...advancedRules};
                                          delete newRules[k];
                                          setAdvancedRules(newRules);
                                          if(advSelectedCol === k) setAdvSelectedCol('');
                              }}
                              className="ml-1 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full p-0.5 transition-colors shrink-0"
                              title="Xóa cấu hình"
                          >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
    
    <div className={`p-4 border-t flex justify-end gap-3 ${themeUI.border} ${themeUI.headerBg}`}>
      <button onClick={() => {
          setShowAdvancedOptions(false);
          if (currentStep === 4) {
              runMultiComparison();
          }
      }} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-md transition-colors text-sm">
        Áp Dụng Lọc Nâng Cao
      </button>
    </div>
  </div>
</div>
)}

{/* TOP NAVBAR */}
<header className="bg-slate-900 text-white flex items-center justify-between px-6 py-3 shrink-0 shadow-md relative z-50">
<div className="flex items-center gap-4 md:gap-6">
  {/* Nút Quay lại ghim cố định ở Header */}
  {backAction && (
     <button onClick={backAction} className="flex items-center justify-center p-1.5 rounded-full hover:bg-slate-700 transition-colors group" title="Quay lại">
       <svg className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
     </button>
  )}

  <div className="flex items-center gap-2 cursor-default">
    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
    <h2 className="text-lg font-bold text-blue-400 tracking-wide">iHRP Pro</h2>
  </div>
  <div className="h-5 w-px bg-slate-700 hidden md:block"></div>
  <div className="hidden md:flex items-center gap-2 font-medium">
    <button 
      onClick={() => {
          if (currentStep === 'formula') {
              setCurrentStep(previousStep || 1);
          } else {
              setCurrentStep(1);
          }
      }} 
      className="text-blue-300 flex items-center bg-slate-800 px-3 py-1.5 rounded cursor-pointer border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors shadow-sm"
      title="Đối soát dữ liệu"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> 
      Module Đối soát dữ liệu
    </button>

    {/* BUTTON TRỢ LÝ CÔNG THỨC GLOBAL */}
    <button 
        onClick={() => {
            if (currentStep !== 'formula') {
                setPreviousStep(currentStep);
            }
            setCurrentStep('formula');
            if (selectedEmpIdForTest) {
                setFormulaTab('sandbox');
                if (testEmpId !== selectedEmpIdForTest) {
                    setTestEmpId(selectedEmpIdForTest);
                    setTestEmpFound(false);
                    setIsCalculated(false);
                    setTestResult(null);
                    setTestVariables({});
                    setTestTargetVal(null);
                    setCalcLogs([]);
                }
            }
        }}
        className={`ml-2 flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs border transition-all ${selectedEmpIdForTest && currentStep !== 'formula' ? 'bg-indigo-600 text-white border-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)] animate-pulse scale-105' : 'bg-slate-800 border-indigo-500/50 text-indigo-400 hover:bg-slate-700'}`}
        title="Trợ lý công thức & Sandbox"
    >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
        {selectedEmpIdForTest && currentStep !== 'formula' ? `Kiểm tra CT NV: ${selectedEmpIdForTest}` : 'Trợ lý Công thức'}
    </button>

  </div>
</div>

<div className="flex items-center gap-3">
  <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors border border-slate-700" title="Đổi giao diện Sáng/Tối">
    {isDarkMode ? <><svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> Sáng</> : <><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg> Tối</>}
  </button>
  <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-400 rounded transition-colors border border-slate-700 hover:border-red-800" title="Tải lại trang và xóa toàn bộ Cache">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
    Làm mới
  </button>
</div>
</header>

{/* SECONDARY HEADER */}
{currentStep !== 4 && currentStep !== 'formula' && (
<div className={`${themeUI.headerBg} shadow-sm px-6 py-3 flex items-center justify-between shrink-0 z-40 transition-colors`}>
  <div className="flex items-center gap-3">
    <div>
      <h1 className={`text-[15px] font-bold ${themeUI.textTitle} leading-tight`}>{stepTitle}</h1>
      <p className={`text-xs ${themeUI.textMuted} mt-0.5`}>{stepDesc}</p>
    </div>
  </div>
</div>
)}
{currentStep === 'formula' && (
<div className={`${themeUI.headerBg} shadow-sm px-6 py-3 flex items-center justify-between shrink-0 z-40 transition-colors border-b ${themeUI.border}`}>
  <div className="flex items-center gap-3">
    <div>
      <h1 className={`text-[16px] font-bold ${themeUI.textTitle} leading-tight flex items-center gap-2`}>
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
        {stepTitle}
      </h1>
      <p className={`text-xs ${themeUI.textMuted} mt-0.5`}>{stepDesc}</p>
    </div>
  </div>
</div>
)}

{/* NỘI DUNG CHÍNH */}
<main className={`flex-1 overflow-y-auto p-4 md:p-6 relative ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
<div className={`mx-auto h-full flex flex-col ${[2, 4, 'formula'].includes(currentStep) ? 'w-full max-w-[100%]' : 'max-w-5xl'}`}>
  
  {/* ================= STEP 1: UPLOAD ================= */}
  {currentStep === 1 && (
    <div className="animate-fade-in space-y-5">
      {/* Box 1: File Gốc */}
      <div className={`${themeUI.cardBg} p-5 rounded-xl shadow-sm transition-colors border relative`}>
        <div 
           className="absolute inset-0 z-50 rounded-xl"
           style={{ display: isDraggingBase ? 'block' : 'none' }}
           onDragEnter={(e) => { e.preventDefault(); setIsDraggingBase(true); }}
           onDragOver={(e) => { e.preventDefault(); setIsDraggingBase(true); }}
           onDragLeave={(e) => { e.preventDefault(); setIsDraggingBase(false); }}
           onDrop={(e) => { e.preventDefault(); setIsDraggingBase(false); handleBaseDrop(e); }}
        >
           <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 border-dashed rounded-xl pointer-events-none" />
        </div>

        <div onDragEnter={(e) => { e.preventDefault(); setIsDraggingBase(true); }} onDragOver={(e) => { e.preventDefault(); setIsDraggingBase(true); }}>
            <h3 className={`font-bold ${themeUI.textTitle} mb-3 flex items-center`}>
              <span className="bg-blue-600 text-white w-5 h-5 rounded flex items-center justify-center mr-2 text-xs">1</span> Tải lên File Gốc (Template chuẩn)
            </h3>
            {!baseFile ? (
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDraggingBase ? 'border-blue-500 bg-blue-500/10' : `${isDarkMode ? 'border-slate-600 hover:border-blue-400 hover:bg-slate-800' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}`} onClick={() => baseInputRef.current.click()}>
                <input type="file" accept=".xlsx, .xls" onChange={handleBaseUpload} className="hidden" ref={baseInputRef} />
                <svg className={`mx-auto h-8 w-8 mb-2 ${isDraggingBase ? 'text-blue-500' : themeUI.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <p className={`${themeUI.textMain} font-medium`}>Nhấn hoặc kéo thả File Gốc vào đây</p>
              </div>
            ) : (
              <div className={`flex flex-col md:flex-row md:items-center justify-between p-3.5 ${isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50/50 border-blue-100'} border rounded-lg gap-4 transition-colors`}>
                <div className="flex items-center w-full max-w-lg">
                  <svg className="w-6 h-6 text-blue-500 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  <div className="w-full">
                    <p className={`font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-900'} truncate`}>{baseFile.name}</p>
                    <div className="flex items-center mt-1">
                      <label className={`${themeUI.textMuted} mr-2 shrink-0 font-medium text-xs`}>Sheet:</label>
                      <select className={`text-xs rounded p-1 w-full shadow-sm focus:ring-blue-500 focus:border-blue-500 ${themeUI.inputBg}`} value={baseFile.sheet} onChange={e => updateSheetSelection('base', e.target.value)}>
                        {baseFile.wb.SheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <button onClick={() => setBaseFile(null)} className={`text-red-500 font-bold px-3 py-1.5 rounded border transition-colors shrink-0 shadow-sm text-xs ${isDarkMode ? 'bg-slate-800 border-slate-600 hover:bg-red-900/50' : 'bg-white border-red-200 hover:bg-red-50'}`}>Đổi File Gốc</button>
              </div>
            )}
        </div>
      </div>

      {/* Box 2: Targets */}
      <div className={`${themeUI.cardBg} p-5 rounded-xl shadow-sm border transition-colors relative`}>
        <div 
           className="absolute inset-0 z-50 rounded-xl pointer-events-none"
           style={{ display: isDraggingTarget ? 'block' : 'none' }}
        >
           <div className="absolute inset-0 bg-purple-500/10 border-2 border-purple-500 border-dashed rounded-xl pointer-events-none" />
        </div>

        <div 
            onDragEnter={(e) => { e.preventDefault(); setIsDraggingTarget(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingTarget(true); }}
            onDragLeave={(e) => { 
               if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingTarget(false);
            }}
            onDrop={(e) => { e.preventDefault(); setIsDraggingTarget(false); handleTargetDrop(e); }}
        >
            <div className={`flex justify-between items-center mb-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-100'} pb-2`}>
              <h3 className={`font-bold ${themeUI.textTitle} flex items-center`}>
                <span className="bg-purple-600 text-white w-5 h-5 rounded flex items-center justify-center mr-2 text-xs">2</span> Các File So Sánh (Targets)
              </h3>
              <input type="file" accept=".xlsx, .xls" multiple onChange={handleTargetUpload} className="hidden" ref={targetInputRef} />
              <button onClick={() => targetInputRef.current.click()} className={`flex items-center px-3 py-1.5 rounded font-bold transition border shadow-sm text-xs z-10 relative ${isDarkMode ? 'bg-purple-900/30 text-purple-400 border-purple-800 hover:bg-purple-900/50' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`}>
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg> Thêm File
              </button>
            </div>

            {targetFiles.length === 0 ? (
              <div className={`p-6 border-2 border-dashed rounded-lg text-center pointer-events-none ${isDraggingTarget ? 'border-purple-500 bg-transparent' : `${isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-gray-300 bg-gray-50'}`}`}>
                <p className={themeUI.textMuted}>Chưa có file so sánh. Kéo thả file vào khu vực này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {targetFiles.map((file, idx) => {
                  const sharedColsCount = baseFile ? file.headers.filter(h => baseFile.headers.includes(h)).length : 0;
                  const hasZeroCommon = baseFile && sharedColsCount === 0;

                  return (
                    <div key={file.id} className={`relative p-3.5 border rounded-lg shadow-sm transition ${hasZeroCommon ? (isDarkMode ? 'border-red-800 bg-red-900/20' : 'border-red-300 bg-red-50') : `${themeUI.innerBox} hover:border-purple-400`}`}>
                      <button onClick={() => removeTargetFile(file.id)} className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center transition shadow border ${isDarkMode ? 'bg-slate-700 text-red-400 border-slate-600 hover:bg-red-500 hover:text-white' : 'bg-red-100 text-red-600 border-red-200 hover:bg-red-600 hover:text-white'}`} title="Xóa file này">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                      <div className="flex items-start">
                        <span className={`font-bold ${themeUI.textMuted} text-xs mr-2 mt-1`}>{idx + 1}.</span>
                        <div className="w-full">
                          <input type="text" className={`w-full font-bold border-b border-dashed focus:outline-none bg-transparent pb-0.5 ${themeUI.inputLine}`} value={file.customName ?? file.name ?? ''} onChange={(e) => updateTargetName(file.id, e.target.value)} title="Đổi tên hiển thị" placeholder="Nhập tên hiển thị..." />
                          <select className={`mt-2 w-full rounded p-1 text-xs focus:ring-purple-500 focus:border-purple-500 ${themeUI.inputBg}`} value={file.sheet} onChange={e => updateSheetSelection('target', e.target.value, file.id)}>
                            {file.wb.SheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </div>
                      </div>
                      {hasZeroCommon && <p className="text-[11px] text-red-500 mt-2 font-bold flex items-center"><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> Không khớp cột nào!</p>}
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
         <button onClick={checkStructureAndProceed} disabled={isProcessing || !baseFile || targetFiles.length === 0} className={`flex items-center px-8 py-2.5 rounded font-bold text-white transition-all shadow-sm ${!baseFile || targetFiles.length === 0 ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>
           {isProcessing ? 'Đang xử lý...' : <>Kiểm Tra <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></>}
         </button>
      </div>
    </div>
  )}

  {/* ================= STEP 2: MAPPING (KIỂM TRA GÁN CỘT) ================= */}
  {currentStep === 2 && (
    <div className={`${themeUI.cardBg} p-5 rounded-xl shadow-sm border animate-fade-in flex flex-col h-full min-h-[500px] transition-colors`}>
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4 border-b ${themeUI.border} pb-3 shrink-0`}>
        <div>
          <h3 className={`font-bold ${themeUI.textTitle} flex items-center text-base`}>
            <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
            Bảng Cấu Hình Ánh Xạ
          </h3>
        </div>
        <div className={`flex flex-wrap items-center gap-3 p-1.5 rounded border ${themeUI.innerBox}`}>
          <label className={`flex items-center space-x-2 cursor-pointer px-2 py-1 ${themeUI.textMain}`}>
            <input type="checkbox" checked={showMapped} onChange={(e) => setShowMapped(e.target.checked)} className="rounded accent-blue-600 w-4 h-4" />
            <span className="font-medium text-xs">Hiện cột đã khớp</span>
          </label>
        </div>
      </div>

      <div className={`overflow-auto border rounded shadow-sm w-full flex-1 min-h-[300px] ${themeUI.innerBox} ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
        <table className="w-full text-left whitespace-nowrap min-w-max border-collapse h-full">
          <thead className={`${themeUI.tableHead} sticky top-0 z-20`}>
            <tr>
              <th className={`p-0 border-r border-b font-bold sticky left-0 z-30 min-w-[200px] ${themeUI.tableHead} ${themeUI.border} align-middle`}>
                 <div className="w-full h-full flex items-center">
                    <ExcelColumnFilter title="Cột File Gốc" uniqueValues={getMappingUnique('base')} activeFilters={mappingFilters['base']} onApplyFilter={(v) => setMappingFilters({...mappingFilters, base: v})} isDarkMode={isDarkMode} />
                 </div>
              </th>
              {targetFiles.map(tf => (
                 <th key={`map-th-${tf.id}`} className={`p-3 border-r border-b font-bold text-center min-w-[220px] ${themeUI.tableHead} ${themeUI.border} align-middle`}>
                    <span className="uppercase tracking-wider text-[11px] truncate opacity-90">{tf.customName || tf.name}</span>
                 </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappingColsToShow.length === 0 ? (
              <tr>
                 <td colSpan={targetFiles.length + 1} className={`p-8 text-center ${themeUI.textMuted} align-top`}>
                   {(!showMapped && targetFiles.every(tf => baseFile.headers.every(h => tf.headers.includes(h)))) ? (
                      <div className="flex flex-col items-center justify-center space-y-2 py-4">
                         <span className={`font-bold text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Tất cả các cột đã tự động khớp tên 100%</span>
                      </div>
                   ) : (
                      "Không có dữ liệu phù hợp."
                   )}
                 </td>
              </tr>
            ) : (
              mappingColsToShow.map(bCol => {
                const hasMissing = targetFiles.some(tf => !tf.headers.includes(bCol) && !columnMappings[tf.id]?.[bCol]);
                return (
                  <tr key={`map-tr-${bCol}`} className={`border-b transition-colors ${hasMissing ? (isDarkMode ? 'bg-red-900/10 hover:bg-red-900/20' : 'bg-red-50/40 hover:bg-red-50') : themeUI.tableRow} ${themeUI.border}`}>
                    <td className={`px-4 py-2.5 border-r font-bold sticky left-0 z-10 text-xs ${themeUI.border} ${themeUI.tableCellBg} ${themeUI.textMain}`}>{bCol}</td>
                    {targetFiles.map(tf => {
                      const exactMatch = tf.headers.includes(bCol);
                      const currentMap = columnMappings[tf.id]?.[bCol];
                      const isMissingCell = !exactMatch && !currentMap;
                      return (
                        <td key={`map-td-${tf.id}-${bCol}`} className={`p-1.5 border-r align-middle ${themeUI.border}`}>
                          {exactMatch ? (
                            <div className="flex justify-center"><span className={`font-semibold flex items-center px-2 py-1.5 rounded border text-xs ${isDarkMode ? 'bg-green-900/30 text-green-400 border-green-800/50' : 'text-green-600 bg-green-50 border-green-100'}`}><svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Trùng tên gốc</span></div>
                          ) : (
                            <SearchableSelect options={tf.headers} value={currentMap} onChange={(newVal) => setColumnMappings(prev => ({...prev, [tf.id]: {...prev[tf.id], [bCol]: newVal}}))} placeholder="Thiếu cột / Bỏ qua" isError={isMissingCell} isDarkMode={isDarkMode} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
            {/* Fill remaining height if any */}
            <tr><td colSpan={targetFiles.length + 1} className="h-full"></td></tr>
          </tbody>
        </table>
      </div>
      <div className="pt-4 flex justify-end shrink-0">
         <button onClick={() => setCurrentStep(3)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-sm transition-colors flex items-center text-sm">
            Tiếp Tục Cấu Hình <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
         </button>
      </div>
    </div>
  )}

  {/* ================= STEP 3: CONFIG ================= */}
  {currentStep === 3 && (
    <div className="animate-fade-in space-y-5">
      <div className={`${themeUI.cardBg} p-5 rounded-xl shadow-sm border transition-colors`}>
        <div className="mb-6">
          <label className={`block font-bold ${themeUI.textTitle} mb-2 flex items-center`}>
             Chọn Cột KEY <span className={`${themeUI.textMuted} font-normal ml-1`}>(Dùng làm mốc)</span>
          </label>
          <SearchableSelect 
             options={availableCols} 
             value={keyCol} 
             onChange={setKeyCol} 
             placeholder="Chọn cột Key..." 
             isError={!keyCol} 
             isDarkMode={isDarkMode} 
             allowClear={false} 
             containerClassName="w-full md:w-80"
          />
          {missingKeyTargets.length > 0 && <div className={`mt-3 ${isDarkMode ? 'text-red-400 bg-red-900/20 border-red-800' : 'text-red-600 bg-red-50 border-red-200'} p-2.5 rounded border inline-block font-medium text-xs`}> Cột KEY "{keyCol}" không tồn tại ở: {missingKeyTargets.map(f => f.customName || f.name).join(', ')}.</div>}
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className={`${themeUI.innerBox} p-4 rounded-lg shadow-inner border`}>
            <h3 className={`text-base font-bold ${themeUI.textTitle} mb-4 flex items-center`}>
              <svg className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Đổi Tên Hiển Thị Của Bảng
            </h3>

            <div className="space-y-4 max-w-3xl">
               <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                  <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Tên bảng gốc</label>
                  <input
                     type="text"
                     className={`w-full p-2 border-b-2 border-dashed focus:outline-none bg-transparent ${isDarkMode ? 'text-white border-slate-500 focus:border-blue-400' : 'text-gray-900 border-gray-300 focus:border-blue-500'}`}
                     value={baseFile?.customName ?? ''}
                     onChange={(e) => setBaseFile({...baseFile, customName: e.target.value})}
                     placeholder="Nhập tên bảng gốc..."
                  />
                  <p className={`text-[10px] mt-1.5 ${themeUI.textMuted}`}>Tên gốc: {baseFile?.name}</p>
               </div>

               {targetFiles.map((tf, i) => (
                 <div key={tf.id} className={`p-4 rounded-lg border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>Tên bảng đối sánh {i + 1}</label>
                    <input
                       type="text"
                       className={`w-full p-2 border-b-2 border-dashed focus:outline-none bg-transparent ${isDarkMode ? 'text-white border-slate-500 focus:border-purple-400' : 'text-gray-900 border-gray-300 focus:border-purple-500'}`}
                       value={tf.customName ?? ''}
                       onChange={(e) => updateTargetName(tf.id, e.target.value)}
                       placeholder="Nhập tên hiển thị..."
                    />
                    <p className={`text-[10px] mt-1.5 ${themeUI.textMuted}`}>Tên gốc: {tf.name}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={runMultiComparison} disabled={isProcessing || availableCols.length === 0 || valCols.length === 0} className={`flex items-center px-8 py-2.5 rounded font-bold text-white shadow-sm transition-colors ${isProcessing || availableCols.length === 0 || valCols.length === 0 ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    {isProcessing 
                        ? (processingMsg || 'Đang xử lý...') 
                        : <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> BẮT ĐẦU ĐỐI SOÁT</>
                    }
          </button>
        </div>
      </div>
    </div>
  )}

  {/* ================= STEP 'rename' ================= */}
  {currentStep === 'rename' && (
    <div className="animate-fade-in space-y-5">
      <div className={`${themeUI.cardBg} p-6 rounded-xl shadow-sm border transition-colors`}>
        <h3 className={`text-lg font-bold ${themeUI.textTitle} mb-6 flex items-center`}>
           <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
           Đổi Tên Hiển Thị Của Bảng
        </h3>
        
        <div className="space-y-4 max-w-2xl">
           <div className={`p-4 rounded-lg border ${themeUI.innerBox}`}>
              <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Tên bảng Gốc (Template)</label>
              <input 
                 type="text" 
                 className={`w-full p-2 border-b-2 border-dashed focus:outline-none bg-transparent ${isDarkMode ? 'text-white border-slate-500 focus:border-blue-400' : 'text-gray-900 border-gray-300 focus:border-blue-500'}`}
                 value={baseFile?.customName ?? ''} 
                 onChange={(e) => setBaseFile({...baseFile, customName: e.target.value})} 
                 placeholder="Nhập tên bảng gốc..." 
              />
              <p className={`text-[10px] mt-1.5 ${themeUI.textMuted}`}>Tên gốc: {baseFile?.name}</p>
           </div>

           {targetFiles.map((tf, i) => (
             <div key={tf.id} className={`p-4 rounded-lg border ${themeUI.innerBox}`}>
                <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>Tên bảng đối sánh {i + 1}</label>
                <input 
                   type="text" 
                   className={`w-full p-2 border-b-2 border-dashed focus:outline-none bg-transparent ${isDarkMode ? 'text-white border-slate-500 focus:border-purple-400' : 'text-gray-900 border-gray-300 focus:border-purple-500'}`}
                   value={tf.customName ?? ''} 
                   onChange={(e) => updateTargetName(tf.id, e.target.value)} 
                   placeholder="Nhập tên hiển thị..." 
                />
                <p className={`text-[10px] mt-1.5 ${themeUI.textMuted}`}>Tên gốc: {tf.name}</p>
             </div>
           ))}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={() => setCurrentStep(3)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-md transition-colors flex items-center text-sm">
            Lưu & Quay Lại <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </button>
        </div>
      </div>
    </div>
  )}

  {/* ================= STEP 4: RESULTS ================= */}
  {currentStep === 4 && results !== null && (
    <div className={`${themeUI.tableCellBg} ${themeUI.textMain} rounded-xl shadow-2xl border ${themeUI.border} animate-fade-in flex flex-col h-full min-h-0 overflow-hidden transition-colors`}>
      
      {/* TOOLBAR */}
      <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-4 border-b shrink-0 z-[60] relative ${isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-4 w-full xl:w-auto">
            <div>
              <h3 className={`text-lg font-bold flex items-center ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Bảng Đối Soát Chi Tiết
              </h3>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 ml-auto">
           <div className={`flex p-1 rounded-md border shadow-inner ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
              {['all', 'diff', 'match', 'missing'].map(filterMode => {
                 const labels = { 'all': 'TẤT CẢ', 'diff': 'KHÁC NHAU', 'match': 'GIỐNG NHAU', 'missing': 'CHỈ 1 BÊN' };
                 
                 let btnClass = isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200';
                 if (globalFilter === filterMode) {
                    btnClass = isDarkMode ? 'bg-blue-600 text-white shadow' : 'bg-white text-blue-700 shadow border border-gray-200';
                 }

                 return (
                   <button
                     key={filterMode} onClick={() => {
                       setGlobalFilter(filterMode);
                       diffNavTracker.current = {}; 
                     }}
                     className={`px-3 py-1 text-xs font-bold rounded whitespace-nowrap transition-all ${btnClass}`}
                   >
                     {labels[filterMode]}
                   </button>
                 )
              })}
           </div>

           <button onClick={() => setShowAdvancedOptions(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-green-400' : 'bg-white border-gray-300 hover:bg-gray-100 text-green-700'}`}>
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Cấu hình nâng cao
           </button>

           <button onClick={handleExportExcel} disabled={isProcessing} className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs border transition-colors ${isDarkMode ? 'bg-emerald-900/30 border-emerald-700 hover:bg-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-700'}`} title="Xuất dữ liệu đang hiển thị ra file Excel">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              Xuất Excel
           </button>

           <div className="relative" ref={colMenuRef}>
             <button onClick={handleToggleColMenu} className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700'}`}>
               <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>
               Cột hiển thị ({displayCols.length})
             </button>
             {showColMenu && (
               <div className={`absolute top-full right-0 mt-2 p-4 rounded-lg shadow-2xl z-[9999] w-72 border flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-gray-200'}`}>
                  <input 
                     type="text" 
                     placeholder="Tìm cột..." 
                     value={colDisplaySearch} 
                     onChange={(e) => setColDisplaySearch(e.target.value)}
                     className={`w-full p-2 text-xs border rounded-md mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow ${themeUI.inputBg}`} 
                     autoFocus
                  />
                  <div className={`overflow-y-auto max-h-[300px] pr-2 flex-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                      {valCols.filter(c => c.toLowerCase().includes(colDisplaySearch.toLowerCase())).length > 0 && (
                        <div className="mb-3">
                          <label className={`flex items-center justify-between pb-2 border-b cursor-pointer hover:opacity-80 transition-opacity ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                            <span className={`font-bold uppercase text-[10px] tracking-wider ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Giá trị</span>
                            <input 
                              type="checkbox" 
                              checked={isAllValDisplayed} 
                              onChange={(e) => toggleAllDisplayVal(e.target.checked)} 
                              className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" 
                              title="Chọn tất cả Cột Giá trị"
                            />
                          </label>
                          <div className="pt-2 pl-1">
                            {valCols.filter(c => c.toLowerCase().includes(colDisplaySearch.toLowerCase())).map(c => (
                               <label key={`disp-v-${c}`} className={`flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity ${themeUI.textMain}`}>
                                   <input type="checkbox" checked={displayCols.includes(c)} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" onChange={(e) => {
                                       if (e.target.checked) setDisplayCols([...displayCols, c]);
                                       else setDisplayCols(displayCols.filter(x => x !== c));
                                   }} />
                                   <span className="text-xs truncate">{c}</span>
                               </label>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div className={`flex flex-wrap items-center gap-8 px-6 py-2.5 border-b shrink-0 z-10 ${isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-slate-50 border-gray-200'}`}>
          <div className="flex items-baseline"><span className={`text-xl font-black mr-2 leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{overviewStats.total}</span> <span className={`${themeUI.textMuted} uppercase text-[10px] tracking-widest font-bold`}>Tổng dòng</span></div>
          <div className="flex items-baseline"><span className="text-xl font-black text-red-500 mr-2 leading-none">{overviewStats.diff}</span> <span className={`${themeUI.textMuted} uppercase text-[10px] tracking-widest font-bold`}>Có sai lệch (Cột đang bật)</span></div>
          <div className="flex items-baseline"><span className={`text-xl font-black mr-2 leading-none ${isDarkMode ? 'text-blue-400' : 'text-orange-500'}`}>{overviewStats.missing}</span> <span className={`${themeUI.textMuted} uppercase text-[10px] tracking-widest font-bold`}>Chỉ có 1 bên</span></div>
          <div className="flex items-baseline"><span className="text-xl font-black text-green-500 mr-2 leading-none">{overviewStats.match}</span> <span className={`${themeUI.textMuted} uppercase text-[10px] tracking-widest font-bold`}>Trùng khớp 100%</span></div>
      </div>

      {/* BẢNG KẾT QUẢ VỚI PAGINATION */}
      {filteredResults.length === 0 ? (
        <div className={`flex flex-col flex-1 min-h-0 relative ${themeUI.tableCellBg}`}>
          {/* FIX ISSUE 4: Luôn hiển thị header bảng dù không có dữ liệu để người dùng có thể xóa bộ lọc */}
          <div className={`overflow-auto w-full ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
            <table className="w-full text-left border-collapse">
              <thead className={`${themeUI.tableHead} sticky top-0 z-30 shadow-md`}>
                <tr>
                  <th className={`p-0 border-b border-r sticky left-0 z-40 align-top ${themeUI.tableHead} ${themeUI.border}`}>
                    <div className="resize-x-handle overflow-auto custom-scrollbar-hide min-w-[140px] max-w-[400px] h-full flex flex-col justify-between">
                      <ExcelColumnFilter 
                          title={keyCol} uniqueValues={getUniqueValues(`V_${keyCol}`)} activeFilters={excelFilters[`V_${keyCol}`]} isDarkMode={isDarkMode}
                          onApplyFilter={(vals) => setExcelFilters({...excelFilters, [`V_${keyCol}`]: vals})} 
                      />
                    </div>
                  </th>
                  {visibleValCols.map(col => (
                    <th key={`th-v-empty-${col}`} className={`p-0 border-b border-r font-bold align-top ${themeUI.border}`}>
                      <div className="resize-x-handle overflow-auto custom-scrollbar-hide min-w-[180px] max-w-[500px] h-full flex flex-col justify-between">
                        <ExcelColumnFilter 
                            title={`[Giá trị] ${col}`} uniqueValues={getUniqueValues(`V_${col}`)} activeFilters={excelFilters[`V_${col}`]} isDarkMode={isDarkMode} badgeCount={getColDiffCount(col)}
                            onApplyFilter={(vals) => setExcelFilters({...excelFilters, [`V_${col}`]: vals})}
                            onBadgeClick={(e) => handleBadgeClick(e, col)} 
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={visibleValCols.length + 1} className={`p-12 text-center ${themeUI.tableCellBg}`}>
                    {overviewStats.diff === 0 && overviewStats.missing === 0 ? (
                        <>
                           <span className="text-4xl mb-3 block">✅</span>
                           <p className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} font-bold text-lg`}>Dữ liệu khớp 100%</p>
                           <p className={`${themeUI.textMuted} mt-1`}>Không có sự sai lệch nào ở các cột bạn đang chọn.</p>
                        </>
                    ) : (
                        <p className={`${themeUI.textMuted} font-medium text-base`}>Không có dữ liệu phù hợp với bộ lọc hiện tại.</p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col flex-1 min-h-0 relative ${themeUI.tableCellBg}`}>
          <div className={`overflow-auto w-full flex-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
            <table className="w-full text-left border-collapse">
              <thead className={`${themeUI.tableHead} sticky top-0 z-30 shadow-md`}>
                <tr>
                  <th className={`p-0 border-b border-r sticky left-0 z-40 align-top ${themeUI.tableHead} ${themeUI.border}`}>
                    <div className="resize-x-handle overflow-auto custom-scrollbar-hide min-w-[140px] max-w-[400px] h-full flex flex-col justify-between">
                      <ExcelColumnFilter 
                          title={keyCol} uniqueValues={getUniqueValues(`V_${keyCol}`)} activeFilters={excelFilters[`V_${keyCol}`]} isDarkMode={isDarkMode}
                          onApplyFilter={(vals) => setExcelFilters({...excelFilters, [`V_${keyCol}`]: vals})} 
                      />
                    </div>
                  </th>
                  
                  {visibleValCols.map(col => (
                    <th key={`th-v-${col}`} className={`p-0 border-b border-r font-bold align-top ${themeUI.border}`}>
                      <div className="resize-x-handle overflow-auto custom-scrollbar-hide min-w-[180px] max-w-[500px] h-full flex flex-col justify-between">
                        <ExcelColumnFilter 
                            title={`[Giá trị] ${col}`} uniqueValues={getUniqueValues(`V_${col}`)} activeFilters={excelFilters[`V_${col}`]} isDarkMode={isDarkMode} badgeCount={getColDiffCount(col)}
                            onApplyFilter={(vals) => setExcelFilters({...excelFilters, [`V_${col}`]: vals})}
                            onBadgeClick={(e) => handleBadgeClick(e, col)} 
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              
              <tbody className={themeUI.tableCellBg}>
                {currentResults.map((row, idx) => (
                  <tr key={idx} id={`row-${row[keyCol]}`} className={`border-b transition-colors group ${themeUI.tableRow} ${themeUI.border}`}>
                    <td className={`px-4 py-3 border-r font-bold sticky left-0 z-[5] align-top ${themeUI.border} ${isDarkMode ? 'bg-[#1e293b] text-white shadow-[1px_0_0_0_#334155] group-hover:bg-slate-800' : 'bg-white text-gray-900 shadow-[1px_0_0_0_#e5e7eb] group-hover:bg-blue-50'} transition-colors`}>
                       <div className="flex items-start gap-2">
                          <input 
                              type="checkbox" 
                              className="mt-1 w-4 h-4 accent-indigo-500 cursor-pointer shrink-0" 
                              checked={selectedEmpIdForTest === row[keyCol]}
                              onChange={() => setSelectedEmpIdForTest(prev => prev === row[keyCol] ? '' : row[keyCol])}
                              title="Chọn nhân viên này để Kiểm tra công thức"
                          />
                          <div className="flex flex-col min-w-0">
                               <span className="cursor-pointer hover:opacity-80 truncate" onClick={() => handleCopy(row[keyCol])} title="Click để Copy">{row[keyCol]}</span>
                               {row.status.some(s => s.includes('Thiếu') || s.includes('Lỗi') || s.includes('Chỉ có')) && (
                                 <div className="mt-2 flex flex-col gap-1 w-max">
                                   {row.status.map((st, sIdx) => {
                                     let badgeColor = isDarkMode ? 'bg-red-900/40 text-red-400 border-red-800/50' : 'bg-red-50 text-red-700 border-red-200';
                                     if (st.includes('Chỉ có')) badgeColor = isDarkMode ? 'bg-blue-900/40 text-blue-400 border-blue-800/50' : 'bg-blue-50 text-blue-700 border-blue-200';
                                     return <span key={sIdx} className={`px-1.5 py-0.5 rounded font-bold border ${badgeColor} uppercase tracking-wider text-[9px] cursor-pointer hover:opacity-80`} onClick={() => handleCopy(st)} title="Click để Copy">
                                       {st}
                                     </span>
                                   })}
                                 </div>
                               )}
                          </div>
                       </div>
                    </td>

                    {visibleValCols.map(col => (
                      <td key={`td-v-${col}`} className={`px-4 py-3 border-r align-top ${themeUI.textMain} ${themeUI.border}`}>
                         {renderStackedCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* THANH PHÂN TRANG (PAGINATION CONTROLS) */}
          {totalPages > 1 && (
            <div className={`p-3 flex items-center justify-between border-t shrink-0 z-20 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-xs font-medium ${themeUI.textMuted}`}>
                 Đang xem <span className={`font-bold ${themeUI.textMain}`}>{(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredResults.length)}</span> trên tổng số <span className={`font-bold ${themeUI.textMain}`}>{filteredResults.length}</span> dòng
              </span>
              
              <div className="flex items-center gap-1.5">
                <button onClick={handleFirstPage} disabled={currentPage === 1} className={`px-2.5 py-1.5 text-xs font-bold rounded border transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed border-transparent' : isDarkMode ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700'}`}>&laquo; Đầu</button>
                <button onClick={handlePrevPage} disabled={currentPage === 1} className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed border-transparent' : isDarkMode ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700'}`}>Trước</button>
                
                <div className={`px-3 py-1 text-xs font-bold rounded mx-1 ${isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
                   Trang {currentPage} / {totalPages}
                </div>
                
                <button onClick={handleNextPage} disabled={currentPage === totalPages} className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed border-transparent' : isDarkMode ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700'}`}>Sau</button>
                <button onClick={handleLastPage} disabled={currentPage === totalPages} className={`px-2.5 py-1.5 text-xs font-bold rounded border transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed border-transparent' : isDarkMode ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700'}`}>Cuối &raquo;</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )}

  {/* ================= STEP 'formula' (TRỢ LÝ CÔNG THỨC) ================= */}
  {currentStep === 'formula' && (
    <div className={`animate-fade-in flex flex-col h-full min-h-[600px] ${themeUI.cardBg} rounded-xl shadow-sm border overflow-hidden`}>
      <div className={`flex border-b ${themeUI.border} bg-black/5 dark:bg-black/20 px-6 pt-4 shrink-0`}>
          <button 
              className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${formulaTab === 'define' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              onClick={() => setFormulaTab('define')}
          >
              1. Định Nghĩa Công Thức
          </button>
          <button 
              className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${formulaTab === 'sandbox' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              onClick={() => setFormulaTab('sandbox')}
          >
              2. Sandbox Mô Phỏng
          </button>
      </div>

      <div className={`overflow-y-auto flex-1 p-6 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
        
        {/* TAB 1: DEFINE FORMULA */}
        {formulaTab === 'define' && (
            <div className="flex flex-col h-full min-h-[500px]">
                <div className="flex flex-col md:flex-row gap-6 flex-1">
                    <div className="flex-1 flex flex-col gap-4">
                        <div>
                            <label className={`font-bold text-sm mb-2 block ${themeUI.textTitle}`}>Mã tiêu chí (Cột Kết quả)</label>
                            <input
                                type="text"
                                className={`w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold ${themeUI.inputBg}`}
                                value={newFormulaTarget}
                                onChange={(e) => setNewFormulaTarget(e.target.value)}
                                placeholder="VD: Hệ số chức danh..."
                            />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <label className={`font-bold text-sm mb-2 flex justify-between items-center ${themeUI.textTitle}`}>
                                Công thức tính toán
                                <span className="text-xs font-normal text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded">Hỗ trợ: + - * / ( ) % | Tiền tố tự bóc tách: TT_..., TK_...</span>
                            </label>
                            <textarea 
                              className={`w-full p-3 border rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] font-mono text-sm leading-relaxed ${themeUI.inputBg}`}
                              placeholder="VD: Hệ số nhân viên * TT_He_so_lam_viec"
                              value={newFormulaExpr}
                              onChange={(e) => {
                                  setNewFormulaExpr(e.target.value);
                                  setHasPreviewed(false); 
                              }}
                          />
                          <div className="flex items-center gap-3 mt-3">
                              <button 
                                  onClick={handlePreviewFormula}
                                  className={`py-2.5 font-bold rounded shadow-sm transition-colors text-sm flex-1 flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'}`}
                              >
                                   Kiểm tra cấu trúc
                              </button>
                              
                              {editingFormulaIdx >= 0 && (
                                  <button 
                                      onClick={() => {
                                          setEditingFormulaIdx(-1);
                                          setNewFormulaTarget('');
                                          setNewFormulaExpr('');
                                          setHasPreviewed(false);
                                          setPreviewVariables([]);
                                      }}
                                      className={`py-2.5 px-4 font-bold rounded shadow-sm transition-colors text-sm ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500 text-white border border-slate-500' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300'}`}
                                  >
                                      Hủy
                                  </button>
                              )}

                              <button 
                                  onClick={() => {
                                      if (!newFormulaTarget || !newFormulaExpr.trim()) {
                                          alert("Vui lòng nhập đủ Mã tiêu chí và Công thức."); return;
                                      }
                                      
                                      if (editingFormulaIdx >= 0) {
                                          const updatedFormulas = [...customFormulas];
                                          updatedFormulas[editingFormulaIdx] = { targetCol: newFormulaTarget, expression: newFormulaExpr };
                                          setCustomFormulas(updatedFormulas);
                                          setEditingFormulaIdx(-1);
                                      } else {
                                          setCustomFormulas([...customFormulas, { targetCol: newFormulaTarget, expression: newFormulaExpr }]);
                                      }

                                      setNewFormulaTarget('');
                                      setNewFormulaExpr('');
                                      setHasPreviewed(false);
                                      setPreviewVariables([]);
                                  }} 
                                  disabled={!newFormulaTarget || !newFormulaExpr.trim()}
                                  className={`py-2.5 px-4 rounded font-bold shadow-md transition-colors text-sm flex-1 ${!newFormulaTarget || !newFormulaExpr.trim() ? 'bg-slate-600 text-gray-300 cursor-not-allowed opacity-70' : (editingFormulaIdx >= 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white')}`}
                              >
                                  {editingFormulaIdx >= 0 ? '✓ Cập nhật' : '+ Lưu Công Thức Mới'}
                              </button>
                          </div>
                      </div>
                  </div>
                  
                  <div className={`w-full md:w-[320px] p-4 border rounded-xl shadow-inner flex flex-col shrink-0 ${isDarkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
                        <label className={`font-bold text-sm mb-3 block ${themeUI.textTitle}`}>Danh sách tiêu chí:</label>
                        <div className={`overflow-y-auto flex-1 pr-1 flex flex-col gap-2 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                            {!hasPreviewed ? (
                                <p className={`text-xs italic text-center mt-4 ${themeUI.textMuted}`}>Nhập công thức bên trái và bấm <br/><b>"Kiểm tra cấu trúc"</b><br/> để hệ thống bóc tách các tiêu chí.</p>
                            ) : previewVariables.length === 0 ? (
                                <p className="text-xs text-red-500 font-bold text-center mt-4">Không tìm thấy tiêu chí nào hợp lệ.</p>
                            ) : (
                                previewVariables.map((v, i) => (
                                    <div key={`preview-var-${i}`} className={`px-3 py-2 border rounded text-xs font-bold truncate transition-colors ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700/50' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`} title={v}>
                                        {v}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 border-t pt-6 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <label className={`font-bold text-sm block ${themeUI.textTitle}`}>Danh sách công thức đã lưu ({customFormulas.length}):</label>
                        <div>
                            <input type="file" accept=".xlsx, .xls" className="hidden" ref={importFormulaRef} onChange={handleImportFormulas} />
                            <button onClick={() => importFormulaRef.current.click()} className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors shadow-sm flex items-center border border-indigo-200 dark:border-indigo-700/50">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                Import từ Excel
                            </button>
                        </div>
                    </div>
                    
                    {customFormulas.length === 0 ? (
                        <p className={`text-sm italic ${themeUI.textMuted}`}>Chưa có công thức nào được tạo.</p>
                    ) : (
                        <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[250px] overflow-y-auto pr-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                            {customFormulas.map((f, idx) => (
                                <div key={idx} className={`flex items-center justify-between p-3 border rounded-lg shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'} ${editingFormulaIdx === idx ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
                                    <div className="flex flex-col gap-1 w-full min-w-0 pr-4">
                                        <span className={`font-bold text-sm ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{f.targetCol}</span>
                                        <span className={`font-mono text-xs truncate ${themeUI.textMain}`} title={f.expression}>{f.expression}</span>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => {
                                                setEditingFormulaIdx(idx);
                                                setNewFormulaTarget(f.targetCol);
                                                setNewFormulaExpr(f.expression);
                                                const vars = extractVariables(f.expression);
                                                setPreviewVariables(vars);
                                                setHasPreviewed(true);
                                            }}
                                            className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors" title="Sửa công thức này"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setCustomFormulas(customFormulas.filter((_, i) => i !== idx));
                                                if (testFormulaIdx === idx) {
                                                    setTestFormulaIdx(-1); setTestResult(null); setTestVariables({}); setTestTargetVal(null); setTestEmpFound(false);
                                                }
                                                if (editingFormulaIdx === idx) {
                                                    setEditingFormulaIdx(-1);
                                                    setNewFormulaTarget('');
                                                    setNewFormulaExpr('');
                                                    setHasPreviewed(false);
                                                    setPreviewVariables([]);
                                                }
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors" title="Xóa"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* TAB 2: SANDBOX */}
        {formulaTab === 'sandbox' && (
            <div className="flex flex-col">
                {customFormulas.length === 0 ? (
                    <div className={`p-8 text-center flex-1 flex flex-col items-center justify-center`}>
                        <span className="text-4xl mb-3">🧪</span>
                        <p className={`${themeUI.textMain} font-bold text-lg`}>Chưa có công thức nào để kiểm tra.</p>
                        <p className={`${themeUI.textMuted} mt-1`}>Vui lòng sang tab Định Nghĩa để tạo công thức trước.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className={`p-4 border rounded-xl flex flex-col sm:flex-row items-start sm:items-end gap-4 shadow-sm shrink-0 ${isDarkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-indigo-50/50 border-indigo-100'}`}>
                            <div className="flex-1 w-full">
                                <label className={`font-bold text-xs mb-1.5 block uppercase tracking-wider ${themeUI.textMuted}`}>1. Mã NV cần kiểm tra</label>
                                <input 
                                    type="text" placeholder="VD: 1022100025..." value={testEmpId} 
                                    onChange={e => {
                                        setTestEmpId(e.target.value);
                                        // Đặt lại các trạng thái để tạo quá trình kiểm tra mới
                                        setTestEmpFound(false);
                                        setIsCalculated(false);
                                        setTestResult(null);
                                        setTestVariables({});
                                        setTestTargetVal(null);
                                        setCalcLogs([]);
                                    }}
                                    className={`w-full p-2.5 text-sm font-bold border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase ${themeUI.inputBg}`} 
                                />
                            </div>
                            <div className="flex-1 relative w-full" ref={sandboxComboRef}>
                                <label className={`font-bold text-xs mb-1.5 block uppercase tracking-wider ${themeUI.textMuted}`}>2. Chọn công thức mô phỏng</label>
                                <div 
                                    onClick={() => setIsSandboxComboOpen(!isSandboxComboOpen)}
                                    className={`w-full p-2.5 border rounded-lg cursor-pointer flex justify-between items-center font-bold text-sm ${themeUI.inputBg} ${isSandboxComboOpen ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-300 dark:border-slate-600'}`}
                                >
                                    <span className={testFormulaIdx >= 0 ? "" : "opacity-50 font-normal truncate"}>
                                        {testFormulaIdx >= 0 && customFormulas[testFormulaIdx] ? customFormulas[testFormulaIdx].targetCol : "-- Chọn công thức --"}
                                    </span>
                                    <svg className={`w-4 h-4 transition-transform ${isSandboxComboOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                                
                                {isSandboxComboOpen && (
                                    <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-gray-300'}`}>
                                        <div className="p-2 border-b dark:border-slate-700">
                                            <input 
                                                type="text" 
                                                placeholder=" Tìm tên công thức..." 
                                                value={sandboxSearch} 
                                                onChange={(e) => setSandboxSearch(e.target.value)} 
                                                className={`w-full p-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${themeUI.inputBg}`} 
                                                autoFocus
                                            />
                                        </div>
                                        <ul className={`max-h-60 overflow-y-auto p-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                                            {customFormulas.map((f, idx) => ({...f, idx})).filter(f => f.targetCol.toLowerCase().includes(sandboxSearch.toLowerCase())).map(f => (
                                                <li 
                                                    key={`sbox-form-${f.idx}`} 
                                                    onClick={() => { setTestFormulaIdx(f.idx); setIsSandboxComboOpen(false); setSandboxSearch(''); setTestResult(null); setIsCalculated(false); setCalcLogs([]); }}
                                                    className={`p-2.5 rounded cursor-pointer text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-indigo-50 text-gray-800'} ${testFormulaIdx === f.idx ? (isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-800') : ''}`}
                                                >
                                                    {f.targetCol}
                                                </li>
                                            ))}
                                            {customFormulas.filter(f => f.targetCol.toLowerCase().includes(sandboxSearch.toLowerCase())).length === 0 && <li className="p-3 text-center text-gray-500 text-xs italic">Không tìm thấy</li>}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <button 
                              onClick={handleTestFormulaLoad}
                              disabled={!testEmpId || testFormulaIdx < 0}
                              className={`w-full sm:w-auto px-8 py-2.5 text-white rounded font-bold shadow transition-colors shrink-0 ${!testEmpId || testFormulaIdx < 0 ? 'bg-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                          >
                              Kiểm Tra
                          </button>
                      </div>

                      {testEmpFound && testFormulaIdx >= 0 && (
                          <div className="flex flex-col lg:flex-row gap-8 mt-4">
                              {/* BIẾN SỐ */}
                              <div className="w-full lg:w-1/2 flex flex-col">
                                  <h4 className={`font-bold text-sm uppercase tracking-wider border-b pb-2 shrink-0 ${isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-700 border-indigo-200'}`}>Các Biến Số Thành Phần</h4>
                                  <p className={`text-[11px] mt-2 mb-4 shrink-0 ${themeUI.textMuted}`}>Hãy thay đổi các con số dưới đây và ấn "Tính Kết Quả" để mô phỏng lại công thức (Dữ liệu mặc định lấy từ File So Sánh).</p>
                                  
                                  {Object.keys(testVariables).length === 0 ? (
                                      <div className="flex items-center justify-center border-2 border-dashed rounded-xl border-red-500/30 bg-red-500/5 p-4 text-center h-[200px]">
                                          <p className="text-sm font-bold text-red-500">Không tìm thấy biến số nào trong công thức.</p>
                                      </div>
                                  ) : (
                                      <div className="flex flex-col gap-3">
                                          {Object.keys(testVariables).map(varName => (
                                              <div key={`var-${varName}`} className="flex items-center gap-4">
                                                  <span className={`w-1/2 font-bold text-sm truncate ${themeUI.textMain}`} title={varName}>{varName}</span>
                                                  <input 
                                                      type="text" 
                                                      className={`w-1/2 p-2.5 border rounded font-mono text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 ${themeUI.inputBg}`}
                                                      value={testVariables[varName]}
                                                      onChange={(e) => {
                                                          const newVars = { ...testVariables, [varName]: e.target.value };
                                                          setTestVariables(newVars);
                                                          setIsCalculated(false); 
                                                          setCalcLogs([]);
                                                      }}
                                                  />
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  
                                  <div className="mt-6 flex flex-col gap-3">
                                      <label className={`flex items-center gap-2 cursor-pointer transition-colors w-max ${isDarkMode ? 'text-indigo-300 hover:text-indigo-100' : 'text-indigo-700 hover:text-indigo-900'}`}>
                                          <input type="checkbox" checked={showConsole} onChange={(e) => setShowConsole(e.target.checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer rounded border-gray-300" />
                                          <span className="font-bold text-xs uppercase tracking-wider">Bật Console Log (Theo dõi từng bước)</span>
                                      </label>

                                      <button 
                                          onClick={() => {
                                              const { result, logs } = evaluateFormula(customFormulas[testFormulaIdx].expression, testVariables, showConsole);
                                              setTestResult(result);
                                              setCalcLogs(logs);
                                              setIsCalculated(true);
                                          }}
                                          className={`w-full py-3 text-white font-bold rounded shadow-md transition-colors flex items-center justify-center gap-2 ${Object.keys(testVariables).length === 0 ? 'bg-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                          disabled={Object.keys(testVariables).length === 0}
                                      >
                                          Tính Toán Kết Quả
                                      </button>
                                  </div>
                              </div>

                              {/* KẾT QUẢ MÔ PHỎNG & CONSOLE */}
                              <div className="w-full lg:w-1/2 flex flex-col gap-4">
                                  <div className={`w-full p-6 border rounded-xl flex flex-col justify-center shadow-inner relative min-h-[300px] h-auto ${isDarkMode ? 'bg-slate-800/80 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
                                      
                                      {/* Trạng thái chờ tính toán */}
                                        {!isCalculated ? (
                                            <div className="flex flex-col items-center justify-center text-center opacity-50 h-full">
                                                <span className="text-4xl mb-3">⏳</span>
                                                <p className={`font-bold text-lg ${themeUI.textMain}`}>Chờ tính toán...</p>
                                                <p className={`text-xs mt-2 ${themeUI.textMuted}`}>Hãy kiểm tra/nhập biến số bên trái và bấm Tính Toán.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Hiệu ứng nền nếu khớp */}
                                                {typeof testTargetVal === 'number' && testResult !== null && testResult !== 'Lỗi tính toán' && testResult !== 'Sai cú pháp' && Math.abs(testResult - testTargetVal) < 0.0001 && (
                                                    <div className="absolute inset-0 bg-green-500/10 pointer-events-none rounded-xl"></div>
                                                )}

                                                <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto">
                                                    <span className={`font-bold uppercase tracking-wider text-[11px] mb-1 ${themeUI.textMuted}`}>Cột Đích (Từ file Gốc)</span>
                                                    <span className={`text-xl font-bold mb-4 ${themeUI.textMain}`}>{customFormulas[testFormulaIdx].targetCol} = <span className="text-blue-500">{testTargetVal !== null ? testTargetVal : '-'}</span></span>

                                                    <span className={`font-bold uppercase tracking-wider text-[11px] mb-1 ${themeUI.textMuted}`}>Kết quả Tính Toán Live</span>
                                                    <span className={`text-3xl font-black font-mono tracking-tighter ${testResult === 'Lỗi tính toán' || testResult === 'Sai cú pháp' ? 'text-red-500 text-2xl' : themeUI.textMain}`}>
                                                        {testResult !== null ? testResult : '-'}
                                                    </span>

                                                    {/* Thông báo so sánh */}
                                                    {testResult !== null && testResult !== 'Lỗi tính toán' && testResult !== 'Sai cú pháp' && (
                                                        <div className={`mt-4 px-4 py-2 rounded-full font-bold text-xs border flex items-center shadow-sm transition-colors ${typeof testTargetVal === 'number' && Math.abs(testResult - testTargetVal) < 0.0001 ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700' : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700'}`}>
                                                            {typeof testTargetVal === 'number' && Math.abs(testResult - testTargetVal) < 0.0001 ? (
                                                                <> <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Đã khớp với dữ liệu Gốc!</>
                                                            ) : (
                                                                typeof testTargetVal === 'string' ? (
                                                                   <> <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> {testTargetVal}</>
                                                                ) : (
                                                                   <> <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> Không khớp dữ liệu Gốc!</>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                  </div>

                                  {/* CONSOLE VIEW */}
                                  {showConsole && isCalculated && calcLogs.length > 0 && (
                                      <div className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-lg animate-fade-in shrink-0">
                                          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
                                              <div className="flex items-center gap-2">
                                                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Terminal Trình Dịch (AST)</span>
                                              </div>
                                              <button className="text-slate-400 hover:text-white transition-colors" onClick={() => setCalcLogs([])} title="Xóa log">
                                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                              </button>
                                          </div>
                                          <div className="p-4 text-[11px] font-mono text-green-400 overflow-y-auto max-h-[250px] leading-relaxed whitespace-pre-wrap text-left custom-dark-scrollbar">
                                              {calcLogs.map((log, i) => {
                                                  let color = "text-slate-300";
                                                  if (log.includes("[ERROR]") || log.includes("[FATAL")) color = "text-red-400";
                                                  else if (log.includes("[START]")) color = "text-blue-400 font-bold";
                                                  else if (log.startsWith("  ->")) color = "text-purple-300";
                                                  else if (log.includes("❌ FAIL")) color = "text-gray-500 line-through decoration-gray-600";
                                                  else if (log.includes("✅ TRUE")) color = "text-green-400 font-bold";
                                                  else if (log.includes("CHỌN KẾT QUẢ") && !log.includes("ELSE")) color = "text-yellow-300 font-bold";
                                                  else if (log.includes("RỚT VÀO ELSE")) color = "text-orange-400 italic";
                                                  else if (log.includes("CHỌN KẾT QUẢ ELSE")) color = "text-yellow-500 font-bold";
                                                  
                                                  return <div key={i} className={`mb-1.5 ${color} break-words`}>{log}</div>
                                              })}
                                          </div>
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
    </div>
  )}

</div>
</main>

<style dangerouslySetInnerHTML={{__html: `
/* === ÉP KIỂU FONT CHỮ TOÀN BỘ GIAO DIỆN === */
body, input, button, select, textarea, th, td, div, span, h1, h2, h3, h4, h5, h6, p, label {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
}

.animate-fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Scrollbar styling for Light mode */
.custom-light-scrollbar::-webkit-scrollbar { width: 8px; height: 10px; }
.custom-light-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
.custom-light-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.custom-light-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Scrollbar styling for Dark mode */
.custom-dark-scrollbar::-webkit-scrollbar { width: 8px; height: 10px; }
.custom-dark-scrollbar::-webkit-scrollbar-track { background: transparent;}
.custom-dark-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px;}
.custom-dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }

/* Resize handle styles */
.resize-x-handle {
    resize: horizontal;
    overflow: auto;
    position: relative;
}
.resize-x-handle::-webkit-resizer {
    background-color: transparent;
    background-image: linear-gradient(135deg, transparent 50%, rgba(156, 163, 175, 0.8) 50%);
    background-size: 10px 10px;
    background-position: bottom right;
    background-repeat: no-repeat;
}
.dark .resize-x-handle::-webkit-resizer {
    background-image: linear-gradient(135deg, transparent 50%, rgba(71, 85, 105, 0.8) 50%);
}

/* Highlight Animation for Badge Click */
@keyframes highlightPulseLight {
    0% { background-color: rgba(79, 70, 229, 0.4); } 
    50% { background-color: rgba(79, 70, 229, 0.2); }
    100% { background-color: transparent; }
}
@keyframes highlightPulseDark {
    0% { background-color: rgba(99, 102, 241, 0.5); }
    50% { background-color: rgba(99, 102, 241, 0.2); }
    100% { background-color: transparent; }
}
.highlight-row-anim {
    animation: highlightPulseLight 2.5s ease-out forwards !important;
}
.dark .highlight-row-anim {
    animation: highlightPulseDark 2.5s ease-out forwards !important;
}
`}} />
</div>
);
}

export default App;