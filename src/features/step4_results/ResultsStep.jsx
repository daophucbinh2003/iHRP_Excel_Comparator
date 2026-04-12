import React from 'react';

import ExcelColumnFilter from '../../components/common/ExcelColumnFilter';
import { useThemeContext } from '../../context/ThemeContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { useFormula } from '../../context/FormulaContext';
import { useComparison } from '../../context/ComparisonContext';

export function ResultsStep() {
    const { themeUI, isDarkMode } = useThemeContext();
  const { setShowAdvancedOptions } = useWorkflow();
  const { selectedEmpIdForTest, setSelectedEmpIdForTest } = useFormula();
  const { globalFilter, setGlobalFilter, colMenuRef, handleToggleColMenu, showColMenu, colDisplaySearch, setColDisplaySearch, isAllValDisplayed, toggleAllDisplayVal, valCols, displayCols, setDisplayCols, overviewStats, keyCol, getUniqueValues, excelFilters, setExcelFilters, getColDiffCount, handleBadgeClick, activeValCols: visibleValCols, currentResults, handleCopy, renderStackedCell, totalPages, currentPage, rowsPerPage, filteredResults, handleFirstPage, handlePrevPage, handleNextPage, handleLastPage, diffNavTracker, handleExportExcel } = useComparison();
    
    // diffNavTracker is a ref in the hook, it's used internally but also in UI for filter clicking.
    // wait, is diffNavTracker exported from hook? Let me check.
    // If not, I can just not use it or add it to export. In UI: diffNavTracker.current = {} whenever filter is clicked.
    // Actually, I will add it if it's missing or just export it from useAppContext later.
    return (
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

                   <button onClick={handleExportExcel} className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs border transition-colors shadow-sm ${isDarkMode ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white' : 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600 text-white'}`} title="Tải xuống tệp Excel chi tiết đã style sẵn">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      Xuất File Excel
                   </button>

                   <button onClick={() => setShowAdvancedOptions(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-green-400' : 'bg-white border-gray-300 hover:bg-gray-100 text-green-700'}`}>
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      Cấu hình nâng cao
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
    );
}

export default ResultsStep;
