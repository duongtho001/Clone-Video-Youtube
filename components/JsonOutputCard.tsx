import React, { useState } from 'react';
import { GeminiAnalysisResponse } from '../types';
import CodeViewer from './CodeViewer';
import { DownloadIcon } from './icons/DownloadIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';


interface JsonOutputCardProps {
    result: GeminiAnalysisResponse;
}

const JsonOutputCard: React.FC<JsonOutputCardProps> = ({ result }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const jsonString = JSON.stringify(result, null, 2);

    const handleCopy = () => {
        navigator.clipboard.writeText(jsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'video_analysis.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                 <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center bg-green-500 rounded-full"><CheckIcon className="w-3 h-3 text-white" /></div>
                    <h3 className="text-base font-semibold text-gray-900">
                        Tổng hợp Kết quả JSON
                    </h3>
                </div>
                 <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            </div>
            {isExpanded && (
                 <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <button 
                            onClick={handleCopy}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-800 text-xs font-semibold rounded-md hover:bg-gray-300 transition-colors"
                        >
                            {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                            {copied ? 'Đã chép' : 'Chép JSON'}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-800 text-xs font-semibold rounded-md hover:bg-gray-300 transition-colors"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            Tải JSON
                        </button>
                    </div>
                    <CodeViewer code={jsonString} language="json" />
                </div>
            )}
        </div>
    );
};

export default JsonOutputCard;