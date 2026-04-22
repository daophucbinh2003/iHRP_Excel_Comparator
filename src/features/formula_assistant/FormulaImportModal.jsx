import React, { useState } from 'react';
import { useThemeContext } from '../../context/ThemeContext';

export function FormulaImportModal({ isOpen, onClose, files, setFiles, onExtract, importRef }) {
    const { themeUI, isDarkMode } = useThemeContext();
    const [isDragging, setIsDragging] = useState(false);

    if (!isOpen) return null;

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
            f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
        );
        if (droppedFiles.length > 0) {
            setFiles(prev => [...prev, ...droppedFiles]);
        }
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${themeUI.cardBg} ${themeUI.border} animate-scale-up`}>
                {/* Header */}
                <div className={`px-6 py-4 border-b flex justify-between items-center ${themeUI.border} bg-black/5 dark:bg-black/20`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 10-8 0v2a2 2 0 002 2h10a2 2 0 002-2v-2a4 4 0 10-8 0v2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>
                        <h3 className={`text-lg font-bold ${themeUI.textTitle}`}>Import Công Thức từ Excel</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {/* Drop Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => importRef.current.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group
                            ${isDragging 
                                ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' 
                                : `border-gray-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-black/5 dark:bg-white/5`
                            }`}
                    >
                        <div className={`p-4 rounded-full transition-transform group-hover:scale-110 ${isDragging ? 'bg-indigo-500 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500'}`}>
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className={`font-bold ${themeUI.textTitle}`}>Kéo thả các file Excel vào đây</p>
                            <p className={`text-sm ${themeUI.textMuted} mt-1`}>Hoặc bấm để chọn từ máy tính (Hỗ trợ .xlsx, .xls)</p>
                        </div>
                        <input 
                            type="file" 
                            multiple 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            ref={importRef}
                            onChange={(e) => {
                                const newFiles = Array.from(e.target.files);
                                setFiles(prev => [...prev, ...newFiles]);
                                e.target.value = null;
                            }}
                        />
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="mt-8 animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <label className={`text-sm font-bold uppercase tracking-wider ${themeUI.textMuted}`}>
                                    Danh sách file ({files.length})
                                </label>
                                <button 
                                    onClick={() => setFiles([])}
                                    className="text-xs font-bold text-red-500 hover:underline"
                                >
                                    Xóa tất cả
                                </button>
                            </div>
                            <div className="grid gap-2">
                                {files.map((file, idx) => (
                                    <div 
                                        key={`${file.name}-${idx}`}
                                        className={`flex items-center justify-between p-3 rounded-lg border group animate-slide-in ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-green-500/10 rounded">
                                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={`text-sm font-bold truncate ${themeUI.textTitle}`}>{file.name}</span>
                                                <span className={`text-[10px] ${themeUI.textMuted}`}>{formatSize(file.size)}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeFile(idx)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-6 border-t flex justify-end gap-3 ${themeUI.border} bg-black/5 dark:bg-black/20`}>
                    <button 
                        onClick={onClose}
                        className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                    >
                        Hủy
                    </button>
                    <button 
                        disabled={files.length === 0}
                        onClick={onExtract}
                        className={`px-8 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all flex items-center gap-2 
                            ${files.length === 0 
                                ? 'bg-slate-500 text-gray-300 cursor-not-allowed opacity-50' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Trích xuất ({files.length} file)
                    </button>
                </div>
            </div>
        </div>
    );
}
