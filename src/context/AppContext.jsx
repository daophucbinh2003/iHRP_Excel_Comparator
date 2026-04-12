import React, { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import { WorkflowProvider } from './WorkflowContext';
import { ComparisonProvider } from './ComparisonContext';
import { FormulaProvider } from './FormulaContext';

export const AppProvider = ({ children }) => {
    const defaultMockFormulas = [
        { targetCol: 'TotalIncome', expression: 'BasicSalary + Allowance + Bonus' },
        { targetCol: 'SocialInsurance', expression: 'BasicSalary * 0.08' },
        { targetCol: 'HealthInsurance', expression: 'BasicSalary * 0.015' },
        { targetCol: 'DependentDeduction', expression: 'NumberOfDependents * 4400000' },
        { targetCol: 'TaxableIncome', expression: 'TotalIncome - DependentDeduction - SocialInsurance - HealthInsurance' },
        { targetCol: 'PersonalIncomeTax', expression: 'dbo.CalculatePIT(TaxableIncome)' },
        { targetCol: 'NetSalary', expression: 'TotalIncome - PersonalIncomeTax' },
        { targetCol: 'BonusTier', expression: 'CASE WHEN KPI >= 90 THEN 5000000 WHEN KPI >= 70 THEN 2000000 ELSE 0 END' },
        { targetCol: 'FinalPaycheck', expression: 'NetSalary + BonusTier + AdvancePayment - DebtDeduction' },
        { targetCol: 'DiscrepancyAmount', expression: 'isnull(FinalPaycheck, 0) - isnull(SysFinalPaycheck, 0)' }
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
