import React, { useState, useEffect, useRef } from 'react';

const SearchableMultiSelect = ({ options, value = [], onChange, placeholder, isError, isSuccess, isDarkMode, containerClassName = "w-full min-w-[160px] mx-auto text-left" }) => {
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

  const filteredOptions = options
    .filter(Boolean)
    .filter(opt => opt.toLowerCase().includes(searchText.toLowerCase()));

  const toggleOption = (opt) => {
    if (value.includes(opt)) {
        onChange(value.filter(v => v !== opt));
    } else {
        onChange([...value, opt]);
    }
  };

  const theme = {
    bg: isDarkMode ? 'bg-[#1e293b]' : 'bg-white',
    border: isDarkMode ? 'border-slate-600' : 'border-gray-300',
    text: isDarkMode ? 'text-slate-200' : 'text-gray-700',
    inputBg: isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    itemHover: isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50',
    selectedBg: isDarkMode ? 'bg-blue-900/50 text-blue-300 border-blue-500' : 'bg-blue-100 text-blue-800 border-blue-500'
  };

  const displayValue = value.length > 0 ? value.join(', ') : placeholder;

  return (
    <div className={`relative ${containerClassName}`} ref={wrapperRef}>
      <div
        className={`flex items-center justify-between w-full p-2 border rounded-md text-xs transition-colors cursor-pointer shadow-sm ${
          isError ? (isDarkMode ? 'border-red-500 bg-red-900/20 text-red-400 font-bold' : 'border-red-400 bg-red-50 text-red-700 font-bold') : 
          isSuccess ? (isDarkMode ? 'border-green-500 bg-green-900/30 text-green-400 font-bold' : 'border-green-400 bg-green-50 text-green-700 font-bold') :
          value.length > 0 ? (isDarkMode ? 'border-blue-500 bg-blue-900/20 text-blue-300 font-bold' : 'border-blue-400 bg-blue-50 text-blue-800 font-bold') : 
          `${theme.border} ${theme.bg} ${theme.text}`
        }`}
        onClick={handleToggle} title={displayValue}
      >
        <div className="flex items-center truncate pr-2 select-none">
          {isSuccess && <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
          <span className="truncate">{displayValue}</span>
        </div>
        <svg className={`w-4 h-4 shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      {isOpen && (
        <div className={`searchable-menu-container ${theme.bg} border ${theme.border} rounded-md shadow-2xl flex flex-col`} style={menuStyle}>
          <div className={`p-2 border-b ${theme.border} shrink-0 rounded-t-md`}>
            <input type="text" className={`w-full p-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${theme.inputBg}`} placeholder="Gõ để tìm cột..." value={searchText} onChange={(e) => setSearchText(e.target.value)} autoFocus />
          </div>
          <ul className={`overflow-y-auto flex-1 py-1 ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
            {filteredOptions.length === 0 ? <li className="px-3 py-4 text-xs opacity-50 italic text-center">Không tìm thấy cột nào</li> : filteredOptions.map(opt => {
              const isSelected = value.includes(opt);
              return (
                <li key={opt} className={`px-3 py-2 text-xs cursor-pointer truncate transition-colors border-l-[3px] flex items-center ${isSelected ? `${theme.selectedBg} font-bold` : `${theme.text} border-transparent ${theme.itemHover}`}`} onClick={() => toggleOption(opt)} title={opt}>
                  <div className={`w-3.5 h-3.5 mr-2 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-400 bg-transparent'}`}>
                      {isSelected && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                  </div>
                  <span className="truncate">{opt}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableMultiSelect;
