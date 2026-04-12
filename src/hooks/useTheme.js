import { useState, useEffect, useMemo } from 'react';

export function useTheme() {
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (isDarkMode) {
            root.classList.add('dark');
            body.classList.add('bg-[#0f172a]', 'text-slate-200');
            body.classList.remove('bg-[#f8f9fc]');
        } else {
            root.classList.remove('dark');
            body.classList.remove('bg-[#0f172a]', 'text-slate-200');
            body.classList.add('bg-[#f8f9fc]');
        }
    }, [isDarkMode]);

    const themeUI = useMemo(() => ({
        appBg: isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f8f9fc]',
        cardBg: isDarkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-gray-200',
        border: isDarkMode ? 'border-slate-700' : 'border-gray-200',
        headerBg: isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-gray-200',
        textMain: isDarkMode ? 'text-slate-200' : 'text-gray-800',
        textMuted: isDarkMode ? 'text-slate-400' : 'text-gray-500',
        textTitle: isDarkMode ? 'text-slate-100' : 'text-gray-900',
        inputBg: isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900',
        innerBox: isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-gray-50 border-gray-200',
        tableHead: isDarkMode ? 'bg-[#0f172a] text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-gray-300',
        tableRow: isDarkMode ? 'hover:bg-slate-800/50 border-slate-700' : 'hover:bg-blue-50/50 border-gray-200',
        tableCellBg: isDarkMode ? 'bg-[#1e293b]' : 'bg-white',
        tdHover: isDarkMode ? 'hover:bg-slate-600/50' : 'hover:bg-blue-100/50',
        inputLine: isDarkMode ? 'border-purple-500 focus:border-purple-300 text-purple-200 bg-transparent' : 'border-purple-300 focus:border-purple-600 text-purple-900 bg-transparent',
        isDarkMode: isDarkMode,
    }), [isDarkMode]);

    const targetColorsLight = ['bg-blue-100 text-blue-800 border-blue-200', 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', 'bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-amber-100 text-amber-800 border-amber-200', 'bg-violet-100 text-violet-800 border-violet-200'];
    const targetColorsDark = ['bg-blue-900/40 text-blue-300 border-blue-700/50', 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-700/50', 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50', 'bg-amber-900/40 text-amber-300 border-amber-700/50', 'bg-violet-900/40 text-violet-300 border-violet-700/50'];

    return { isDarkMode, setIsDarkMode, themeUI, targetColorsLight, targetColorsDark };
}