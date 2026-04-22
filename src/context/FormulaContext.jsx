import React, { createContext, useContext, useState } from 'react';
import { useFormulaAssistant } from '../hooks/useFormulaAssistant';
import { useWorkflow } from './WorkflowContext';
import { useComparison } from './ComparisonContext';

const FormulaContext = createContext();

export const useFormula = () => useContext(FormulaContext);

export const FormulaProvider = ({ children, customFormulas, setCustomFormulas, selectedEmpIdForTest, setSelectedEmpIdForTest }) => {
    const { setToastMessage } = useWorkflow();
    const { baseFile, targetFiles, keyCol, results } = useComparison();

    const [graphViewFormula, setGraphViewFormula] = useState(null);
    const [isGraphOpen, setIsGraphOpen] = useState(false);
    const [chainViewFormula, setChainViewFormula] = useState(null);
    const [isChainOpen, setIsChainOpen] = useState(false);

    const formulaAssistantProps = useFormulaAssistant(
        baseFile,
        targetFiles,
        keyCol,
        results,
        setToastMessage,
        customFormulas,
        setCustomFormulas
    );

    return (
        <FormulaContext.Provider value={{
            ...formulaAssistantProps,
            customFormulas, setCustomFormulas,
            selectedEmpIdForTest, setSelectedEmpIdForTest,
            graphViewFormula, setGraphViewFormula,
            isGraphOpen, setIsGraphOpen,
            chainViewFormula, setChainViewFormula,
            isChainOpen, setIsChainOpen
        }}>
            {children}
        </FormulaContext.Provider>
    );
};
