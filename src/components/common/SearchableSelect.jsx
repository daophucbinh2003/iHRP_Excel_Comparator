import React, { useState, useEffect, useRef } from 'react';

const SearchableSelect = ({ options, value, onChange, placeholder, isError, defaultText, isDarkMode, allowClear = true, containerClassName = "w-full min-w-[160px] mx-auto text-left" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const wrapperRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  useEffect(() => { if (isOpen) setSearchText(''); }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const menuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      let topPos = rect.bottom + 4;
      if (spaceBelow < menuHeight && rect.top > menuHeight) topPos = rect.top - menuHeight - 4;
      
      setMenuStyle({ position: 'fixed', top: `${topPos}px`, left: `${rect.left}px`, width: `${Math.max(rect.width, 240)}px`, maxHeight: `${menuHeight}px`, zIndex: 99999 });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = (e) => { if (isOpen && e.target && !e.target.closest?.('.searchable-menu-container')) setIsOpen(false); };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchText.toLowerCase()));

  const theme = {
    bg: isDarkMode ? 'bg-[#1e293b]' : 'bg-white',
    border: isDarkMode ? 'border-slate-600' : 'border-gray-300',
    text: isDarkMode ? 'text-slate-200' : 'text-gray-700',
    inputBg: isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    itemHover: isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50',
    selectedBg: isDarkMode ? 'bg-blue-900/50 text-blue-300 border-blue-500' : 'bg-blue-100 text-blue-800 border-blue-500'
  };

  return (
    <div className={`relative ${containerClassName}`} ref={wrapperRef}>
      <div
        className={`flex items-center justify-between w-full p-2 border rounded-md text-xs transition-colors cursor-pointer shadow-sm ${
          isError ? (isDarkMode ? 'border-red-500 bg-red-900/20 text-red-400 font-bold' : 'border-red-400 bg-red-50 text-red-700 font-bold') : 
          value ? (isDarkMode ? 'border-blue-500 bg-blue-900/20 text-blue-300 font-bold' : 'border-blue-400 bg-blue-50 text-blue-800 font-bold') : 
          `${theme.border} ${theme.bg} ${theme.text}`
        }`}
        onClick={handleToggle} title={value || placeholder}
      >
        <span className="truncate pr-2 select-none">{value || placeholder}</span>
        <svg className={`w-4 h-4 shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      {isOpen && (
        <div className={`searchable-menu-container ${theme.bg} border ${theme.border} rounded-md shadow-2xl flex flex-col`} style={menuStyle}>
          <div className={`p-2 border-b ${theme.border} shrink-0 rounded-t-md`}>
            <input type="text" className={`w-full p-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${theme.inputBg}`} placeholder="Gõ để tìm cột..." value={searchText} onChange={(e) => setSearchText(e.target.value)} autoFocus />
          </div>
          <ul className={`overflow-y-auto flex-1 py-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
            {allowClear && (
               <li className={`px-3 py-2 text-xs font-medium cursor-pointer border-b ${theme.border} transition-colors ${isDarkMode ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`} onClick={() => { onChange(''); setIsOpen(false); }}>-- {defaultText || 'Bỏ qua / Thiếu'} --</li>
            )}
            {filteredOptions.length === 0 ? <li className="px-3 py-4 text-xs opacity-50 italic text-center">Không tìm thấy cột nào</li> : filteredOptions.map(opt => <li key={opt} className={`px-3 py-2 text-xs cursor-pointer truncate transition-colors border-l-[3px] ${value === opt ? `${theme.selectedBg} font-bold` : `${theme.text} border-transparent ${theme.itemHover}`}`} onClick={() => { onChange(opt); setIsOpen(false); }} title={opt}>{opt}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;