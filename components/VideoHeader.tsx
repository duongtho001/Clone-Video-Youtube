import React from 'react';
import type { VideoMetadata } from '../types';
import { CcIcon } from './icons/CcIcon';

interface VideoHeaderProps {
    metadata: VideoMetadata;
}

const VideoHeader: React.FC<VideoHeaderProps> = ({ metadata }) => {
    return (
        <div className="bg-white rounded-lg p-4 flex flex-col sm:flex-row items-start gap-4 border border-gray-200">
            <div className="flex-shrink-0 w-full sm:w-48">
                <img 
                    src={metadata.thumbnail_url} 
                    alt="Video thumbnail" 
                    className="rounded-md w-full h-auto aspect-video object-cover"
                />
            </div>
            <div className="flex-grow">
                <h2 className="text-xl font-bold text-gray-900">{metadata.title}</h2>
                <p className="text-sm text-gray-500 mt-1">bởi {metadata.author_name}</p>
                 {metadata.hasCaptions && (
                    <div className="mt-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                           <CcIcon className="w-4 h-4" />
                            Có Phụ Đề
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoHeader;