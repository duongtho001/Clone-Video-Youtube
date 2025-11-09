import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';

interface ApiKeyModalProps {
    isOpen: boolean;
    onContinue: (newKey: string) => void;
    onCancel: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onContinue, onCancel }) => {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setApiKey(''); // Reset input when modal opens
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleContinueClick = () => {
        if (apiKey.trim()) {
            onContinue(apiKey.trim());
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center gap-3">
                     <div className="w-10 h-10 flex-shrink-0 bg-red-100 rounded-full flex items-center justify-center">
                        <KeyIcon className="w-6 h-6 text-red-600" />
                     </div>
                    <div>
                        <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                           Đã hết hạn mức tất cả API Keys
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Quá trình phân tích đã tạm dừng vì tất cả các key bạn cung cấp đều đã hết quota. Vui lòng cung cấp một API Key mới để tiếp tục.
                        </p>
                    </div>
                </div>

                <div>
                    <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-1">
                        API Key Gemini mới
                    </label>
                    <input
                        id="api-key-input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Dán API Key mới của bạn vào đây"
                        className="w-full bg-gray-50 border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-semibold rounded-md hover:bg-gray-300 transition-colors"
                    >
                        Hủy Phân Tích
                    </button>
                    <button
                        onClick={handleContinueClick}
                        disabled={!apiKey.trim()}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        Tiếp tục
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
