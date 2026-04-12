import React from 'react';
import ExcelColumnFilter from '../../components/common/ExcelColumnFilter';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useThemeContext } from '../../context/ThemeContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { useComparison } from '../../context/ComparisonContext';


export function MappingStep() {
    const { themeUI, isDarkMode } = useThemeContext();
  const { setCurrentStep } = useWorkflow();
  const { baseFile, targetFiles, showMapped, setShowMapped, getMappingUnique, mappingFilters, setMappingFilters, mappingColsToShow, columnMappings, setColumnMappings } = useComparison();

    return (
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
                                    <ExcelColumnFilter title="Cột File Gốc" uniqueValues={getMappingUnique('base')} activeFilters={mappingFilters['base']} onApplyFilter={(v) => setMappingFilters({ ...mappingFilters, base: v })} isDarkMode={isDarkMode} />
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
                                    {(!showMapped && baseFile && targetFiles.every(tf => baseFile.headers.every(h => tf.headers.includes(h)))) ? (
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
                                                        <SearchableSelect options={tf.headers} value={currentMap} onChange={(newVal) => setColumnMappings(prev => ({ ...prev, [tf.id]: { ...prev[tf.id], [bCol]: newVal } }))} placeholder="Thiếu cột / Bỏ qua" isError={isMissingCell} isDarkMode={isDarkMode} />
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
    );
}