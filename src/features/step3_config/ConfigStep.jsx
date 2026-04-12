import React from 'react';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useThemeContext } from '../../context/ThemeContext';
import { useComparison } from '../../context/ComparisonContext';


export function ConfigStep() {
    const { themeUI, isDarkMode } = useThemeContext();
  const { availableCols, keyCol, setKeyCol, missingKeyTargets, baseFile, setBaseFile, targetFiles, updateTargetName, runMultiComparison, isProcessing, processingMsg, valCols } = useComparison();

    return (
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
                                    onChange={(e) => setBaseFile({ ...baseFile, customName: e.target.value })}
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
                    <button onClick={runMultiComparison} disabled={isProcessing || availableCols.length === 0 || valCols.length === 0} className={`flex items-center px-8 py-2.5 rounded font-bold text-white shadow-sm transition-colors ${isProcessing || availableCols.length === 0 || valCols.length === 0 ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`} title={isProcessing ? processingMsg : ''}>
                        {isProcessing
                            ? (processingMsg || 'Đang xử lý...')
                            : <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> BẮT ĐẦU ĐỐI SOÁT</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}