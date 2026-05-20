import React, { createContext, useContext, useState } from 'react';
import { useFileHandler } from '../hooks/useFileHandler';
import { useComparisonConfig } from '../hooks/useComparisonConfig';
import { useComparisonResults } from '../hooks/useComparisonResults';
import { useWorkflow } from './WorkflowContext';
import { useThemeContext } from './ThemeContext';

const ComparisonContext = createContext();

export const useComparison = () => useContext(ComparisonContext);

export const ComparisonProvider = ({ children, customFormulas, selectedEmpIdForTest, setSelectedEmpIdForTest }) => {
    const { setCurrentStep, setToastMessage } = useWorkflow();
    const { themeUI, targetColorsLight, targetColorsDark } = useThemeContext();

    const fileHandlerProps = useFileHandler();
    const comparisonConfigProps = useComparisonConfig(fileHandlerProps.baseFile, fileHandlerProps.targetFiles);
    
    const comparisonResultsProps = useComparisonResults(
        fileHandlerProps.baseFile,
        fileHandlerProps.targetFiles,
        comparisonConfigProps.keyCols,
        comparisonConfigProps.valCols,
        comparisonConfigProps.columnMappings,
        customFormulas,
        comparisonConfigProps.advancedRules,
        themeUI,
        targetColorsLight,
        targetColorsDark,
        setCurrentStep,
        setToastMessage,
        selectedEmpIdForTest,
        setSelectedEmpIdForTest
    );

    return (
        <ComparisonContext.Provider value={{
            ...fileHandlerProps,
            ...comparisonConfigProps,
            ...comparisonResultsProps
        }}>
            {children}
        </ComparisonContext.Provider>
    );
};
