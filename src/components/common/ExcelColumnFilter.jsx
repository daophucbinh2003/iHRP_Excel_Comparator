import React, { useState, useEffect, useRef } from 'react';

const ExcelColumnFilter = ({ title, uniqueValues, activeFilters, onApplyFilter, isDarkMode, badgeCount, onBadgeClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const wrapperRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Khởi tạo selection dựa trên activeFilters hiện tại,
      // nhưng chỉ giữ những giá trị CÒN TỒN TẠI trong danh sách uniqueValues theo ngữ cảnh hiện tại.
      // Nếu chưa có filter nào → mặc định chọn tất cả.
      if (activeFilters && activeFilters.length > 0) {
        const validSelected = activeFilters.filter(v => uniqueValues.includes(v));
        setSelected(validSelected.length > 0 ? validSelected : [...uniqueValues]);
      } else {
        setSelected([...uniqueValues]);
      }
      setSearch('');
      const rect = wrapperRef.current.getBoundingClientRect();
      const menuHeight = 280; 
      const spaceBelow = window.innerHeight - rect.bottom;
      
      let topPos = rect.bottom + 4;
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
          topPos = rect.top - menuHeight - 4;
      }
      const leftPos = Math.min(rect.left, window.innerWidth - 260); 
      setMenuStyle({
        position: 'fixed',
        top: `${topPos}px`,
        left: `${leftPos}px`,
        zIndex: 999999,
      });
    }
  }, [isOpen, activeFilters, uniqueValues]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target) && !event.target.closest?.('.excel-filter-popup')) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVals = uniqueValues.filter(v => String(v).toLowerCase().includes(search.toLowerCase()));
  const isAllSelected = filteredVals.length > 0 && filteredVals.every(v => selected.includes(v));

  const handleToggleAll = () => {
    const allFilteredSelected = filteredVals.every(v => selected.includes(v));
    if (allFilteredSelected) {
      setSelected(selected.filter(v => !filteredVals.includes(v)));
    } else {
      setSelected([...new Set([...selected, ...filteredVals])]);
    }
  };

  const toggleOne = (val) => {
    if (selected.includes(val)) setSelected(selected.filter(v => v !== val));
    else setSelected([...selected, val]);
  };

  const handleApply = () => {
    // Nếu người dùng chọn hết toàn bộ uniqueValues theo ngữ cảnh hiện tại → bỏ filter (null)
    const allContextSelected = uniqueValues.every(v => selected.includes(v));
    if (allContextSelected) onApplyFilter(null);
    else onApplyFilter(selected);
    setIsOpen(false);
  };

  const hasFilter = activeFilters && activeFilters.length < uniqueValues.length;

  const theme = {
    bg: isDarkMode ? 'bg-[#242424]' : 'bg-white',
    border: isDarkMode ? 'border-[#3a3a3a]' : 'border-gray-200',
    text: isDarkMode ? 'text-slate-200' : 'text-gray-800',
    inputBg: isDarkMode ? 'bg-[#1a1a1a] border-[#4a4a4a] text-white' : 'bg-gray-50 border-gray-300 text-gray-900',
    hoverItem: isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-blue-50',
    footerBg: isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-50',
  };

  return (
    <div className="relative block w-full h-full" ref={wrapperRef}>
      <div 
        className={`flex items-start justify-between cursor-pointer group px-3 py-2.5 h-full w-full transition-colors ${hasFilter ? 'bg-[#107c41]/20' : isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-200/50'}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center flex-1 min-w-0 pr-2">
            <span className="uppercase tracking-wider text-[11px] font-bold truncate opacity-90 leading-tight text-left mr-1.5">{title}</span>
            {badgeCount > 0 && (
                <span 
                    className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black leading-none shadow-sm shrink-0 cursor-pointer hover:bg-red-600 hover:scale-110 transition-all z-10" 
                    title={`${badgeCount} dòng sai lệch. Nhấn để chuyển đến dòng lỗi tiếp theo!`}
                    onClick={onBadgeClick}
                >
                    {badgeCount}
                </span>
            )}
        </div>
        <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${hasFilter ? 'text-green-500' : isDarkMode ? 'text-slate-400 group-hover:text-slate-200' : 'text-gray-400 group-hover:text-gray-700'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 00-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
        </svg>
      </div>

      {isOpen && (
        <div className={`excel-filter-popup fixed ${theme.bg} ${theme.text} border ${theme.border} shadow-2xl rounded-lg w-64 flex flex-col font-sans normal-case text-[13px] tracking-normal`} style={menuStyle}>
           <div className={`p-3 border-b ${theme.border}`}>
               <div className="relative">
                   <input 
                      type="text" placeholder="Tìm kiếm..." value={search} onChange={e=>setSearch(e.target.value)} 
                      className={`w-full ${theme.inputBg} rounded-md pl-8 pr-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow`} 
                      autoFocus
                   />
                   <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
               </div>
           </div>
           <div className={`p-2 max-h-56 overflow-y-auto ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
               <label className={`flex items-center gap-2.5 px-2 py-1.5 ${theme.hoverItem} rounded cursor-pointer transition-colors`}>
                   <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} className="accent-blue-600 w-3.5 h-3.5 rounded-sm cursor-pointer" />
                   <span className="font-bold opacity-90">(Chọn tất cả)</span>
               </label>
               {filteredVals.map(v => (
                   <label key={v} className={`flex items-center gap-2.5 px-2 py-1.5 mb-0.5 ${theme.hoverItem} rounded cursor-pointer transition-colors`}>
                      <input type="checkbox" checked={selected.includes(v)} onChange={() => toggleOne(v)} className="accent-blue-600 w-3.5 h-3.5 rounded-sm cursor-pointer" />
                      <span className="truncate font-medium opacity-80">{v === '' ? '(Trống)' : v}</span>
                   </label>
               ))}
           </div>
           <div className={`p-2.5 border-t ${theme.border} flex justify-between items-center ${theme.footerBg} rounded-b-lg`}>
               <span className="text-[10px] text-gray-400 pl-1 font-medium">{selected.length} đang chọn</span>
               <div className="flex gap-2">
                 <button onClick={()=>setIsOpen(false)} className={`px-3 py-1.5 ${isDarkMode ? 'hover:bg-[#3a3a3a] text-gray-300' : 'hover:bg-gray-200 text-gray-700'} rounded font-medium transition-colors text-xs`}>Hủy</button>
                 <button onClick={handleApply} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors text-xs">Áp dụng lọc</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ExcelColumnFilter;