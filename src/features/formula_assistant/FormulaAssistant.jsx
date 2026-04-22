import React from 'react';

import { extractVariables } from '../../utils/astCompiler';
import { useThemeContext } from '../../context/ThemeContext';
import { useFormula } from '../../context/FormulaContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { FormulaImportModal } from './FormulaImportModal';

export function FormulaAssistant() {
    const { themeUI, isDarkMode } = useThemeContext();
  const { formulaTab, setFormulaTab, newFormulaTarget, setNewFormulaTarget, newFormulaExpr, setNewFormulaExpr, hasPreviewed, setHasPreviewed, previewVariables, setPreviewVariables, editingFormulaIdx, setEditingFormulaIdx, customFormulas, setCustomFormulas, importFormulaRef, handleImportFormulas, handlePreviewFormula, testEmpId, setTestEmpId, testFormulaIdx, setTestFormulaIdx, isSandboxComboOpen, setIsSandboxComboOpen, sandboxSearch, setSandboxSearch, sandboxComboRef, handleTestFormulaLoad, testEmpFound, setTestEmpFound, testVariables, setTestVariables, showConsole, setShowConsole, handleCalculateSandboxFormula, isCalculated, setIsCalculated, testResult, setTestResult, testTargetVal, setTestTargetVal, calcLogs, setCalcLogs, setGraphViewFormula, setIsGraphOpen, setChainViewFormula, setIsChainOpen, isImportModalOpen, setIsImportModalOpen, importFiles, setImportFiles, handleExtractFormulas, formulaSearch, setFormulaSearch } = useFormula();
  const { currentStep, setCurrentStep, setPreviousStep } = useWorkflow();

    const handleSaveClick = () => {
        if (!newFormulaTarget || !newFormulaExpr.trim()) {
            alert("Vui lòng nhập đủ Mã tiêu chí và Công thức."); return;
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
        setCustomFormulas(customFormulas.filter((_, i) => i !== idx));
        if (testFormulaIdx === idx) {
            setTestFormulaIdx(-1); setTestResult(null); setTestVariables({}); setTestTargetVal(null); setTestEmpFound(false);
        }
        if (editingFormulaIdx === idx) {
            handleCancelEditClick();
        }
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
        setIsSandboxComboOpen(false);
        setSandboxSearch('');
        setTestResult(null);
        setIsCalculated(false);
        setCalcLogs([]);
    };

    return (
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
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
                            {/* EDITOR SECTION */}
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

                            {/* PREVIEW/HELP SECTION */}
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
                                                previewVariables.map((v, idx) => (
                                                    <div key={idx} className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-700 hover:border-indigo-500/50' : 'bg-slate-50 border-slate-200 hover:border-indigo-500/50'}`}>
                                                        <span className="font-mono font-bold text-indigo-500 truncate mr-2">{v}</span>
                                                        <span className="shrink-0 px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-md font-black text-[9px] uppercase tracking-wider">Dependency</span>
                                                    </div>
                                                ))
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

                        {/* LIST SECTION */}
                        <div className="mt-8 border-t pt-8 dark:border-slate-800 shrink-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div className="flex flex-col gap-1">
                                    <label className={`font-bold text-sm block ${themeUI.textTitle}`}>Danh sách công thức đã lưu ({customFormulas.length}):</label>
                                    <p className={`text-[10px] ${themeUI.textMuted}`}>Các công thức này sẽ được áp dụng khi chạy Đối soát.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:w-64">
                                        <input 
                                            type="text" 
                                            placeholder="Tìm mã tiêu chí hoặc nội dung..." 
                                            value={formulaSearch}
                                            onChange={(e) => setFormulaSearch(e.target.value)}
                                            className={`w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${themeUI.inputBg}`}
                                        />
                                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        {formulaSearch && (
                                            <button onClick={() => setFormulaSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-all shadow-sm flex items-center border border-indigo-200 dark:border-indigo-700/50 whitespace-nowrap"><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Import từ Excel</button>
                                </div>
                            </div>
                            {customFormulas.length === 0 ? (
                                <p className={`text-sm italic ${themeUI.textMuted}`}>Chưa có công thức nào được tạo.</p>
                            ) : (
                                <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                                    {customFormulas
                                        .map((f, idx) => ({ ...f, originalIdx: idx }))
                                        .filter(f => 
                                            f.targetCol.toLowerCase().includes(formulaSearch.toLowerCase()) || 
                                            f.expression.toLowerCase().includes(formulaSearch.toLowerCase())
                                        )
                                        .map((f) => (
                                            <div key={f.originalIdx} className={`flex items-center justify-between p-3 border rounded-lg shadow-sm group transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-800 border-slate-600 hover:border-slate-500' : 'bg-white border-gray-200 hover:border-indigo-300'} ${editingFormulaIdx === f.originalIdx ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
                                                <div className="flex flex-col gap-1 w-full min-w-0 pr-4">
                                                    <span className={`font-bold text-sm truncate ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{f.targetCol}</span>
                                                    <span className={`font-mono text-[10px] truncate ${themeUI.textMain} opacity-70`} title={f.expression}>{f.expression}</span>
                                                </div>
                                                <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setChainViewFormula(f); setPreviousStep(currentStep); setCurrentStep('chain_trace'); }} className="p-1.5 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors" title="Truy nguồn gốc (Chain Tracer)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg></button>
                                                    <button onClick={() => { setGraphViewFormula(f); setIsGraphOpen(true); }} className="p-1.5 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-colors" title="Xem sơ đồ phụ thuộc (Mindmap)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" /></svg></button>
                                                    <button onClick={() => handleEditClick(f, f.originalIdx)} className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors" title="Sửa công thức này"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                                                    <button onClick={() => handleDeleteClick(f.originalIdx)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors" title="Xóa"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                                </div>
                                            </div>
                                        ))}
                                    {customFormulas.filter(f => f.targetCol.toLowerCase().includes(formulaSearch.toLowerCase()) || f.expression.toLowerCase().includes(formulaSearch.toLowerCase())).length === 0 && (
                                        <div className="col-span-full py-12 text-center">
                                            <p className={`text-sm italic ${themeUI.textMuted}`}>Không tìm thấy công thức nào khớp với "{formulaSearch}"</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {formulaTab === 'sandbox' && (
                    <div className="flex flex-col">
                        {customFormulas.length === 0 ? (<div className={`p-8 text-center flex-1 flex flex-col items-center justify-center`}><span className="text-4xl mb-3">🧪</span><p className={`${themeUI.textMain} font-bold text-lg`}>Chưa có công thức nào để kiểm tra.</p><p className={`${themeUI.textMuted} mt-1`}>Vui lòng sang tab Định Nghĩa để tạo công thức trước.</p></div>) : (
                            <div className="flex flex-col gap-6">
                                <div className={`p-4 border rounded-xl flex flex-col sm:flex-row items-start sm:items-end gap-4 shadow-sm shrink-0 ${isDarkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-indigo-50/50 border-indigo-100'}`}>
                                    <div className="flex-1 w-full"><label className={`font-bold text-xs mb-1.5 block uppercase tracking-wider ${themeUI.textMuted}`}>1. Mã NV cần kiểm tra</label><input type="text" placeholder="VD: 1022100025..." value={testEmpId} onChange={handleTestEmpIdChange} className={`w-full p-2.5 text-sm font-bold border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase ${themeUI.inputBg}`} /></div>
                                    <div className="flex-1 relative w-full" ref={sandboxComboRef}>
                                        <label className={`font-bold text-xs mb-1.5 block uppercase tracking-wider ${themeUI.textMuted}`}>2. Chọn công thức mô phỏng (Từ danh sách đã lưu)</label>
                                        <div onClick={() => setIsSandboxComboOpen(!isSandboxComboOpen)} className={`w-full p-2.5 border rounded-lg cursor-pointer flex justify-between items-center font-bold text-sm ${themeUI.inputBg} ${isSandboxComboOpen ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-300 dark:border-slate-600'}`}><span className={testFormulaIdx >= 0 ? "" : "opacity-50 font-normal truncate"}>{testFormulaIdx >= 0 && customFormulas[testFormulaIdx] ? customFormulas[testFormulaIdx].targetCol : "-- Chọn công thức --"}</span><svg className={`w-4 h-4 transition-transform ${isSandboxComboOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                                        {isSandboxComboOpen && (<div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#1e293b] border-slate-600' : 'bg-white border-gray-300'}`}><div className="p-2 border-b dark:border-slate-700"><input type="text" placeholder=" Tìm tên công thức..." value={sandboxSearch} onChange={(e) => setSandboxSearch(e.target.value)} className={`w-full p-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${themeUI.inputBg}`} autoFocus /></div><ul className={`max-h-60 overflow-y-auto p-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>{customFormulas.map((f, idx) => ({ ...f, idx })).filter(f => f.targetCol.toLowerCase().includes(sandboxSearch.toLowerCase())).map(f => (<li key={`sbox-form-${f.idx}`} onClick={() => handleSandboxFormulaSelect(f.idx)} className={`p-2.5 rounded cursor-pointer text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-indigo-50 text-gray-800'} ${testFormulaIdx === f.idx ? (isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-800') : ''}`}>{f.targetCol}</li>))}{customFormulas.filter(f => f.targetCol.toLowerCase().includes(sandboxSearch.toLowerCase())).length === 0 && <li className="p-3 text-center text-gray-500 text-xs italic">Không tìm thấy</li>}</ul></div>)}
                                    </div>
                                    <button onClick={handleTestFormulaLoad} title="Tải dữ liệu nhân viên và công thức để bắt đầu mô phỏng" disabled={!testEmpId || testFormulaIdx < 0} className={`w-full sm:w-auto px-8 py-2.5 text-white rounded font-bold shadow transition-colors shrink-0 ${!testEmpId || testFormulaIdx < 0 ? 'bg-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}>Kiểm Tra</button>
                                </div>
                                {testEmpFound && testFormulaIdx >= 0 && (
                                    <div className="flex flex-col lg:flex-row gap-8 mt-4">
                                        <div className="w-full lg:w-1/2 flex flex-col">
                                            <h4 className={`font-bold text-sm uppercase tracking-wider border-b pb-2 shrink-0 ${isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-700 border-indigo-200'}`}>Các Biến Số Thành Phần</h4><p className={`text-[11px] mt-2 mb-4 shrink-0 ${themeUI.textMuted}`}>Hãy thay đổi các con số dưới đây và ấn "Tính Kết Quả" để mô phỏng lại công thức (Dữ liệu mặc định lấy từ File So Sánh).</p>
                                            {Object.keys(testVariables).length === 0 ? (<div className="flex items-center justify-center border-2 border-dashed rounded-xl border-red-500/30 bg-red-500/5 p-4 text-center h-[200px]"><p className="text-sm font-bold text-red-500">Không tìm thấy biến số nào trong công thức.</p></div>) : (<div className="flex flex-col gap-3">{Object.keys(testVariables).map(varName => (<div key={`var-${varName}`} className="flex items-center gap-4"><span className={`w-1/2 font-bold text-sm truncate ${themeUI.textMain}`} title={varName}>{varName}</span><input type="text" className={`w-1/2 p-2.5 border rounded font-mono text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 ${themeUI.inputBg}`} value={testVariables[varName]} onChange={(e) => { const newVars = { ...testVariables, [varName]: e.target.value }; setTestVariables(newVars); setIsCalculated(false); setCalcLogs([]); }} /></div>))}</div>)}
                                            <div className="mt-6 flex flex-col gap-3"><label title="Hiển thị chi tiết các bước xử lý của trình biên dịch" className={`flex items-center gap-2 cursor-pointer transition-colors w-max ${isDarkMode ? 'text-indigo-300 hover:text-indigo-100' : 'text-indigo-700 hover:text-indigo-900'}`}><input type="checkbox" checked={showConsole} onChange={(e) => setShowConsole(e.target.checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer rounded border-gray-300" /><span className="font-bold text-xs uppercase tracking-wider">Bật Console Log (Theo dõi từng bước)</span></label><button onClick={handleCalculateSandboxFormula} title="Tính toán kết quả dựa trên các giá trị biến hiện tại" className={`w-full py-3 text-white font-bold rounded shadow-md transition-colors flex items-center justify-center gap-2 ${Object.keys(testVariables).length === 0 ? 'bg-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`} disabled={Object.keys(testVariables).length === 0}>Tính Toán Kết Quả</button></div>
                                        </div>
                                        <div className="w-full lg:w-1/2 flex flex-col gap-4">
                                            <div className={`w-full p-6 border rounded-xl flex flex-col justify-center shadow-inner relative min-h-[300px] h-auto ${isDarkMode ? 'bg-slate-800/80 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
                                                {!isCalculated ? (<div className="flex flex-col items-center justify-center text-center opacity-50 h-full"><span className="text-4xl mb-3">⏳</span><p className={`font-bold text-lg ${themeUI.textMain}`}>Chờ tính toán...</p><p className={`text-xs mt-2 ${themeUI.textMuted}`}>Hãy kiểm tra/nhập biến số bên trái và bấm Tính Toán.</p></div>) : (<>{typeof testTargetVal === 'number' && testResult !== null && testResult !== 'Lỗi tính toán' && testResult !== 'Sai cú pháp' && Math.abs(testResult - testTargetVal) < 0.0001 && (<div className="absolute inset-0 bg-green-500/10 pointer-events-none rounded-xl"></div>)}<div className="relative z-10 flex flex-col items-center justify-center text-center my-auto"><span className={`font-bold uppercase tracking-wider text-[11px] mb-1 ${themeUI.textMuted}`}>Cột Đích (Từ file Gốc)</span><span className={`text-xl font-bold mb-4 ${themeUI.textMain}`}>{customFormulas[testFormulaIdx].targetCol} = <span className="text-blue-500">{testTargetVal !== null ? testTargetVal : '-'}</span></span><span className={`font-bold uppercase tracking-wider text-[11px] mb-1 ${themeUI.textMuted}`}>Kết quả Tính Toán Live</span><span className={`text-3xl font-black font-mono tracking-tighter ${testResult === 'Lỗi tính toán' || testResult === 'Sai cú pháp' ? 'text-red-500 text-2xl' : themeUI.textMain}`}>{testResult !== null ? testResult : '-'}</span>{testResult !== null && testResult !== 'Lỗi tính toán' && testResult !== 'Sai cú pháp' && (<div className={`mt-4 px-4 py-2 rounded-full font-bold text-xs border flex items-center shadow-sm transition-colors ${typeof testTargetVal === 'number' && Math.abs(testResult - testTargetVal) < 0.0001 ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700' : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700'}`}>{typeof testTargetVal === 'number' && Math.abs(testResult - testTargetVal) < 0.0001 ? (<> <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Đã khớp với dữ liệu Gốc!</>) : (typeof testTargetVal === 'string' ? (<> <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> {testTargetVal}</>) : (<> <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> Không khớp dữ liệu Gốc!</>))}</div>)}</div></>)}
                                            </div>
                                            {showConsole && isCalculated && calcLogs.length > 0 && (<div className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-lg animate-fade-in shrink-0"><div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0"><div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Terminal Trình Dịch (AST)</span></div><button className="text-slate-400 hover:text-white transition-colors" onClick={() => setCalcLogs([])} title="Xóa log"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div><div className="p-4 text-[11px] font-mono text-green-400 overflow-y-auto max-h-[250px] leading-relaxed whitespace-pre-wrap text-left custom-dark-scrollbar">{calcLogs.map((log, i) => { let color = "text-slate-300"; if (log.includes("[ERROR]") || log.includes("[FATAL")) color = "text-red-400"; else if (log.includes("[START]")) color = "text-blue-400 font-bold"; else if (log.startsWith("  ->")) color = "text-purple-300"; else if (log.includes("❌ FAIL")) color = "text-gray-500 line-through decoration-gray-600"; else if (log.includes("✅ TRUE")) color = "text-green-400 font-bold"; else if (log.includes("CHỌN KẾT QUẢ") && !log.includes("ELSE")) color = "text-yellow-300 font-bold"; else if (log.includes("RỚT VÀO ELSE")) color = "text-orange-400 italic"; else if (log.includes("CHỌN KẾT QUẢ ELSE")) color = "text-yellow-500 font-bold"; return <div key={i} className={`mb-1.5 ${color} break-words`}>{log}</div> })}</div></div>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <FormulaImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                files={importFiles}
                setFiles={setImportFiles}
                onExtract={handleExtractFormulas}
                importRef={importFormulaRef}
            />
        </div>
    );
}