import React from 'react';
import { LibraryEntry } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';
import { XIcon } from './icons/XIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface LibraryItemProps {
    item: LibraryEntry;
    onDelete: (id: string) => void;
}

const formatDuration = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes} phút ${seconds} giây`;
    }
    return `${seconds} giây`;
};


export const LibraryItem: React.FC<LibraryItemProps> = ({ item, onDelete }) => {
    
    const handleDownloadTxt = () => {
        if (!item.result) return;
        const prompts = item.result.scenes.map((scene, index) => {
            // Destructure to exclude metadata fields and keep only the prompt fields
            const { scene_id, t0, t1, summary, ...promptObject } = scene;
            return `${index + 1}. ${JSON.stringify(promptObject)}`;
        }).join('\n\n');
        const blob = new Blob([prompts], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle}_scene_prompts.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadScript = () => {
        if (!item.result?.story_outline) {
            alert("Dữ liệu tóm tắt không có sẵn cho mục cũ này. Vui lòng phân tích lại video để tạo tóm tắt mới.");
            return;
        }

        const { title } = item.result.video_meta;
        const { parts } = item.result.story_outline;

        const fullSummary = parts.map(part => part.summary.trim()).join(' ');

        const fileContent = `TÓM TẮT CỐT TRUYỆN: ${title}\n\n${fullSummary}`;

        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle}_story_summary.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const getBorderClass = () => {
        switch (item.status) {
            case 'complete': return 'border-green-300';
            case 'error': return 'border-red-300';
            case 'processing': return 'border-blue-400 border-dashed';
            case 'pending': return 'border-gray-200';
            default: return 'border-gray-200';
        }
    };

    const duration = item.completedAt && item.createdAt ? formatDuration(item.completedAt - item.createdAt) : null;

    return (
        <div className={`bg-white rounded-lg p-3 flex items-start gap-4 border relative transition-colors ${getBorderClass()}`}>
             <img 
                src={item.thumbnail_url || 'https://placehold.co/128x72/e2e8f0/e2e8f0/png'} 
                alt="Video thumbnail" 
                className="rounded-md w-28 h-auto aspect-video object-cover flex-shrink-0 bg-gray-200"
            />
            <div className="flex-grow">
                <p className="text-sm font-semibold text-gray-800 line-clamp-2">{item.title}</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:underline break-all">{item.url}</a>
                
                 {item.status === 'pending' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                        <span>Đang chờ trong hàng...</span>
                    </div>
                )}

                {item.status === 'processing' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
                        <LoadingSpinner className="w-4 h-4" />
                        <span>Đang xử lý...</span>
                    </div>
                )}

                {item.status === 'complete' && item.result && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <button
                            onClick={handleDownloadTxt}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 transition-colors"
                        >
                            <DownloadIcon className="w-3 h-3" />
                            Tải Prompts (.txt)
                        </button>
                        <button
                            onClick={handleDownloadScript}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md hover:bg-blue-200 transition-colors"
                        >
                            <ClipboardIcon className="w-3 h-3" />
                            Tải Tóm tắt Cốt truyện
                        </button>
                        <span className="text-xs text-gray-500 font-medium">
                            Số cảnh: {item.result.scenes.length}
                        </span>
                        {duration && (
                             <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                                <ClockIcon className="w-3 h-3" />
                                {duration}
                            </span>
                        )}
                    </div>
                )}
                 {item.status === 'error' && (
                    <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded-md">
                        <p className="font-semibold">Lỗi:</p>
                        <p className="line-clamp-3">{item.error}</p>
                    </div>
                 )}
            </div>
             <button
                onClick={() => onDelete(item.id)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Xóa mục"
            >
                <XIcon className="w-4 h-4" />
            </button>
        </div>
    );
};