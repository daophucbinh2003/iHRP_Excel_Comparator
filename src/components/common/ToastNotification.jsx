import React from 'react';

const ToastNotification = ({ message }) => {
    if (!message) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[999999] bg-green-600 text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in border border-green-500">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            <span className="font-medium text-sm">{message}</span>
        </div>
    );
};

export default ToastNotification;