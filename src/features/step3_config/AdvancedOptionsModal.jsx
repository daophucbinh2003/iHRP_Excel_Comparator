import React, { useEffect } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { useComparison } from '../../context/ComparisonContext';


const AdvancedOptionsModal = () => {
    const { themeUI, isDarkMode } = useThemeContext();
  const { setShowAdvancedOptions, currentStep } = useWorkflow();
  const { advComboRef, advSelectedCol, setAdvSelectedCol, advSearchCol, setAdvSearchCol, isAdvComboOpen, setIsAdvComboOpen, filteredAdvCols, advancedRules, setAdvancedRules, runMultiComparison } = useComparison();

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event) {
            if (advComboRef.current && !advComboRef.current.contains(event.target)) {
                setIsAdvComboOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsAdvComboOpen, advComboRef]);

    const handleApply = () => {
        setShowAdvancedOptions(false);
        if (currentStep === 4) {
            runMultiComparison();
        }
    };

    return (
        <div className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[75vh] min-h-[500px] overflow-hidden ${themeUI.cardBg}`}>
                <div className={`p-4 border-b flex justify-between items-center ${themeUI.border} ${themeUI.headerBg} shrink-0`}>
                    <h3 className={`text-lg font-bold flex items-center ${themeUI.textTitle}`} title="Cấu hình nâng cao">
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
                                    <input type="checkbox" className="mt-1 accent-blue-600 w-4 h-4 cursor-pointer" checked={advancedRules[advSelectedCol]?.partialMatch || false} onChange={(e) => { setAdvancedRules({ ...advancedRules, [advSelectedCol]: { ...advancedRules[advSelectedCol], partialMatch: e.target.checked } }) }} />
                                    <div>
                                        <span className={`font-bold block ${themeUI.textMain}`}>Khớp một phần</span>
                                        <p className={`text-xs mt-1 ${themeUI.textMuted}`}>Dùng cho dữ liệu chữ. Nếu một chuỗi nằm trong chuỗi còn lại thì coi là khớp.</p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${advancedRules[advSelectedCol]?.roundNumber ? (isDarkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-300') : (isDarkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}>
                                    <input type="checkbox" className="mt-1 accent-purple-600 w-4 h-4 cursor-pointer" checked={advancedRules[advSelectedCol]?.roundNumber || false} onChange={(e) => { setAdvancedRules({ ...advancedRules, [advSelectedCol]: { ...advancedRules[advSelectedCol], roundNumber: e.target.checked } }) }} />
                                    <div className="w-full">
                                        <span className={`font-bold block ${themeUI.textMain}`}>Làm tròn số liệu (Round)</span>
                                        <p className={`text-xs mt-1 mb-2 ${themeUI.textMuted}`}>Dùng cho dữ liệu số. Hệ thống sẽ làm tròn và tự động sửa kết quả hiển thị của dòng đó.</p>
                                        {advancedRules[advSelectedCol]?.roundNumber && (
                                            <div className={`flex items-center gap-2.5 mt-3 p-2.5 rounded-lg border w-max transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                <span className={`text-xs font-bold ${themeUI.textMain}`}>Làm tròn đến</span>
                                                <input type="number" className={`w-16 p-1 text-center font-bold text-sm border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDarkMode ? 'bg-slate-700 text-white border-slate-500 focus:bg-slate-600' : 'bg-white text-gray-900 border-gray-300 focus:bg-gray-50'}`} value={advancedRules[advSelectedCol]?.decimals !== undefined ? advancedRules[advSelectedCol].decimals : 2} onChange={(e) => { let val = e.target.value; setAdvancedRules({ ...advancedRules, [advSelectedCol]: { ...advancedRules[advSelectedCol], decimals: val === '' ? '' : parseInt(val, 10) } }) }} onClick={(e) => e.stopPropagation()} />
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
                                        <button onClick={() => { const newRules = {...advancedRules}; delete newRules[k]; setAdvancedRules(newRules); if(advSelectedCol === k) setAdvSelectedCol(''); }} className="ml-1 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full p-0.5 transition-colors shrink-0" title="Xóa cấu hình">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className={`p-4 border-t flex justify-end gap-3 ${themeUI.border} ${themeUI.headerBg}`}>
                    <button onClick={handleApply} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-md transition-colors text-sm">
                        Áp Dụng Lọc Nâng Cao
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedOptionsModal;