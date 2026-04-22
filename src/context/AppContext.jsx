import React, { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import { WorkflowProvider } from './WorkflowContext';
import { ComparisonProvider } from './ComparisonContext';
import { FormulaProvider } from './FormulaContext';

export const AppProvider = ({ children }) => {
    const defaultMockFormulas = [
        { targetCol: 'Total_Net_Salary', expression: 'ROUND(Base_Salary + Performance_Bonus - Social_Insurance_Amt, 0)' },
        { targetCol: 'Performance_Bonus', expression: 'CASE WHEN KPI_Score >= 100 THEN Base_Salary * 0.2 WHEN KPI_Score >= 80 THEN Base_Salary * 0.1 ELSE 0 END' },
        { targetCol: 'Social_Insurance_Amt', expression: 'IF(Is_Full_Insurance == 1, Base_Salary * 0.105, Min_Wages * 0.105)' },
        { targetCol: 'Is_Full_Insurance', expression: '1' },
        { targetCol: 'KPI_Score', expression: '95' },
        { targetCol: 'Base_Salary', expression: '15000000' },
        { targetCol: 'Min_Wages', expression: '4420000' }
    ];

    const [customFormulas, setCustomFormulas] = useState(defaultMockFormulas);
    const [selectedEmpIdForTest, setSelectedEmpIdForTest] = useState('');

    return (
        <ThemeProvider>
            <WorkflowProvider>
                <ComparisonProvider customFormulas={customFormulas} selectedEmpIdForTest={selectedEmpIdForTest} setSelectedEmpIdForTest={setSelectedEmpIdForTest}>
                    <FormulaProvider customFormulas={customFormulas} setCustomFormulas={setCustomFormulas} selectedEmpIdForTest={selectedEmpIdForTest} setSelectedEmpIdForTest={setSelectedEmpIdForTest}>
                        {children}
                    </FormulaProvider>
                </ComparisonProvider>
            </WorkflowProvider>
        </ThemeProvider>
    );
};
