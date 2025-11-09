import React from 'react';
import { GeminiAnalysisResponse } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface Step6CardProps {
    result: GeminiAnalysisResponse;
}

const Step6Card: React.FC<Step6CardProps> = ({ result }) => {

    const handleDownloadTxt = () => {
        // Create a string where each line is the JSON string of a scene, prefixed with a number, separated by a blank line.
        const prompts = result.scenes.map((scene, index) => {
            // Destructure to exclude metadata fields and keep only the prompt fields
            const { scene_id, t0, t1, summary, ...promptObject } = scene;
            return `${index + 1}. ${JSON.stringify(promptObject)}`;
        }).join('\n\n');
        
        const blob = new Blob([prompts], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene_prompts.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center bg-green-500 rounded-full"><CheckIcon className="w-3 h-3 text-white" /></div>
                    <h3 className="text-base font-semibold text-gray-900">
                        Tạo Prompts cho mỗi Cảnh
                    </h3>
                </div>
                <div className="pl-8 mt-2 space-y-3">
                    <p className="text-sm text-gray-600">
                        Đã tạo thành công {result.scenes.length} prompt JSON chi tiết. Tải về tệp .txt để sử dụng trong các công cụ tạo video AI. Mỗi dòng trong tệp là một prompt JSON hoàn chỉnh cho một cảnh.
                    </p>
                    <button
                        onClick={handleDownloadTxt}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Tải Prompts (.txt)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Step6Card;