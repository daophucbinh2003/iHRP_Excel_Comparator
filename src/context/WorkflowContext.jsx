import React, { createContext, useContext, useState, useEffect } from 'react';

const WorkflowContext = createContext();

export const useWorkflow = () => useContext(WorkflowContext);

export const WorkflowProvider = ({ children }) => {
    const [xlsxLoaded, setXlsxLoaded] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [previousStep, setPreviousStep] = useState(1);
    const [toastMessage, setToastMessage] = useState('');
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    return (
        <WorkflowContext.Provider value={{
            xlsxLoaded, setXlsxLoaded,
            currentStep, setCurrentStep,
            previousStep, setPreviousStep,
            toastMessage, setToastMessage,
            showAdvancedOptions, setShowAdvancedOptions
        }}>
            {children}
        </WorkflowContext.Provider>
    );
};
