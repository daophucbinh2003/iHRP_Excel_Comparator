import React, { createContext, useContext } from 'react';
import { useTheme } from '../hooks/useTheme';

const ThemeContext = createContext();

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const themeProps = useTheme();
    return (
        <ThemeContext.Provider value={themeProps}>
            {children}
        </ThemeContext.Provider>
    );
};
