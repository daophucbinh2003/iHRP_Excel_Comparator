import React, { useRef, useState } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { useComparison } from '../../context/ComparisonContext';


// Giả sử bạn sẽ truyền các props này từ App.jsx (hoặc từ Context sau này)
export function UploadStep() {
    const { themeUI } = useThemeContext();
  const { setCurrentStep } = useWorkflow();
  const { baseFile, setBaseFile, targetFiles, removeTargetFile, updateTargetName, updateSheetSelection, handleBaseUpload, handleBaseDrop, handleTargetUpload, handleTargetDrop } = useComparison();

    const [isDraggingBase, setIsDraggingBase] = useState(false);
    const [isDraggingTarget, setIsDraggingTarget] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // Local processing state for this step
    const baseInputRef = useRef(null);
    const targetInputRef = useRef(null);

    const checkStructureAndProceed = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setCurrentStep(2);
        }, 200);
    };

    return (
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
                        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDraggingBase ? 'border-blue-500 bg-blue-500/10' : `${themeUI.isDarkMode ? 'border-slate-600 hover:border-blue-400 hover:bg-slate-800' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}`} onClick={() => baseInputRef.current.click()}>
                            <input type="file" accept=".xlsx, .xls" onChange={handleBaseUpload} className="hidden" ref={baseInputRef} />
                            <svg className={`mx-auto h-8 w-8 mb-2 ${isDraggingBase ? 'text-blue-500' : themeUI.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            <p className={`${themeUI.textMain} font-medium`}>Nhấn hoặc kéo thả File Gốc vào đây</p>
                        </div>
                    ) : (
                        <div className={`flex flex-col md:flex-row md:items-center justify-between p-3.5 ${themeUI.isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50/50 border-blue-100'} border rounded-lg gap-4 transition-colors`}>
                            <div className="flex items-center w-full max-w-lg">
                                <svg className="w-6 h-6 text-blue-500 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <div className="w-full">
                                    <p className={`font-bold ${themeUI.isDarkMode ? 'text-blue-300' : 'text-blue-900'} truncate`}>{baseFile.name}</p>
                                    <div className="flex items-center mt-1">
                                        <label className={`${themeUI.textMuted} mr-2 shrink-0 font-medium text-xs`}>Sheet:</label>
                                        <select className={`text-xs rounded p-1 w-full shadow-sm focus:ring-blue-500 focus:border-blue-500 ${themeUI.inputBg}`} value={baseFile.sheet} onChange={e => updateSheetSelection('base', e.target.value)}>
                                            {baseFile.wb.SheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setBaseFile(null)} className={`text-red-500 font-bold px-3 py-1.5 rounded border transition-colors shrink-0 shadow-sm text-xs ${themeUI.isDarkMode ? 'bg-slate-800 border-slate-600 hover:bg-red-900/50' : 'bg-white border-red-200 hover:bg-red-50'}`}>Đổi File Gốc</button>
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
                    <div className={`flex justify-between items-center mb-4 border-b ${themeUI.isDarkMode ? 'border-slate-700' : 'border-gray-100'} pb-2`}>
                        <h3 className={`font-bold ${themeUI.textTitle} flex items-center`}>
                            <span className="bg-purple-600 text-white w-5 h-5 rounded flex items-center justify-center mr-2 text-xs">2</span> Các File So Sánh (Targets)
                        </h3>
                        <input type="file" accept=".xlsx, .xls" multiple onChange={handleTargetUpload} className="hidden" ref={targetInputRef} />
                        <button onClick={() => targetInputRef.current.click()} className={`flex items-center px-3 py-1.5 rounded font-bold transition border shadow-sm text-xs z-10 relative ${themeUI.isDarkMode ? 'bg-purple-900/30 text-purple-400 border-purple-800 hover:bg-purple-900/50' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`}>
                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg> Thêm File
                        </button>
                    </div>

                    {targetFiles.length === 0 ? (
                        <div className={`p-6 border-2 border-dashed rounded-lg text-center pointer-events-none ${isDraggingTarget ? 'border-purple-500 bg-transparent' : `${themeUI.isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-gray-300 bg-gray-50'}`}`}>
                            <p className={themeUI.textMuted}>Chưa có file so sánh. Kéo thả file vào khu vực này.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            {targetFiles.map((file, idx) => {
                                const sharedColsCount = baseFile ? file.headers.filter(h => baseFile.headers.includes(h)).length : 0;
                                const hasZeroCommon = baseFile && sharedColsCount === 0;

                                return (
                                    <div key={file.id} className={`relative p-3.5 border rounded-lg shadow-sm transition ${hasZeroCommon ? (themeUI.isDarkMode ? 'border-red-800 bg-red-900/20' : 'border-red-300 bg-red-50') : `${themeUI.innerBox} hover:border-purple-400`}`}>
                                        <button onClick={() => removeTargetFile(file.id)} className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center transition shadow border ${themeUI.isDarkMode ? 'bg-slate-700 text-red-400 border-slate-600 hover:bg-red-500 hover:text-white' : 'bg-red-100 text-red-600 border-red-200 hover:bg-red-600 hover:text-white'}`} title="Xóa file này">
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
    );
}