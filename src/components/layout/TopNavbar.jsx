import React from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { useFormula } from '../../context/FormulaContext';
import { useComparison } from '../../context/ComparisonContext';


const TopNavbar = () => {
    const { isDarkMode, setIsDarkMode } = useThemeContext();
  const { currentStep, setCurrentStep, previousStep, setPreviousStep } = useWorkflow();
  const { selectedEmpIdForTest, setFormulaTab, testEmpId, setTestEmpId, setTestEmpFound, setIsCalculated, setTestResult, setTestVariables, setTestTargetVal, setCalcLogs } = useFormula();
  const { results } = useComparison();

    let backAction = null;
    if (currentStep === 2) backAction = () => setCurrentStep(1);
    else if (currentStep === 3) backAction = () => setCurrentStep(2);
    else if (currentStep === 'rename') backAction = () => setCurrentStep(3);
    else if (currentStep === 4) backAction = () => setCurrentStep(3);
    else if (currentStep === 'formula') backAction = () => setCurrentStep(previousStep);
    else if (currentStep === 'chain_trace') backAction = () => setCurrentStep('formula');

    return (
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
                            if (currentStep !== 'formula') { setPreviousStep(currentStep); }
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

            <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors border border-slate-700" title="Đổi giao diện Sáng/Tối">{isDarkMode ? <><svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> Sáng</> : <><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg> Tối</>}</button>
                <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-400 rounded transition-colors border border-slate-700 hover:border-red-800" title="Tải lại trang và xóa toàn bộ Cache"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Làm mới</button>
            </div>
        </header>
    );
};

export default TopNavbar;