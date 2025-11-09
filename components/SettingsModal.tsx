import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: string[]) => void;
    initialKeys: string[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialKeys }) => {
    const [keysText, setKeysText] = useState('');

    useEffect(() => {
        if (isOpen) {
            setKeysText(initialKeys.join('\n'));
        }
    }, [isOpen, initialKeys]);

    if (!isOpen) return null;

    const handleSave = () => {
        const keys = keysText.split('\n').map(k => k.trim()).filter(Boolean);
        onSave(keys);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            aria-labelledby="settings-modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 flex-shrink-0 bg-red-100 rounded-full flex items-center justify-center">
                        <KeyIcon className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h2 id="settings-modal-title" className="text-lg font-semibold text-gray-900">
                            Quản lý API Keys
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Nhập danh sách API Key Gemini của bạn, mỗi key một dòng. Hệ thống sẽ tự động chuyển key khi hết hạn mức.
                        </p>
                    </div>
                </div>

                <div>
                    <label htmlFor="api-keys-textarea" className="block text-sm font-medium text-gray-700 mb-1">
                        Danh sách API Keys
                    </label>
                    <textarea
                        id="api-keys-textarea"
                        rows={6}
                        value={keysText}
                        onChange={(e) => setKeysText(e.target.value)}
                        placeholder="Dán các API Key của bạn vào đây, mỗi key trên một dòng..."
                        className="w-full bg-gray-50 border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none font-mono"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-semibold rounded-md hover:bg-gray-300 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition-colors"
                    >
                        Lưu Thay Đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
