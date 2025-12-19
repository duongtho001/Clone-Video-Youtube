
import React from 'react';
import type { VideoMetadata } from '../types';
import { CcIcon } from './icons/CcIcon';

interface VideoHeaderProps {
    metadata: VideoMetadata;
}

const VideoHeader: React.FC<VideoHeaderProps> = ({ metadata }) => {
    const isLocal = metadata.videoId.startsWith('local');

    return (
        <div className="bg-white rounded-lg p-4 flex flex-col items-stretch border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0 w-full sm:w-80">
                    {isLocal && metadata.localBlobUrl ? (
                        <video 
                            src={metadata.localBlobUrl} 
                            controls 
                            className="rounded-lg w-full h-auto aspect-video bg-black shadow-inner"
                        />
                    ) : (
                        <img 
                            src={metadata.thumbnail_url} 
                            alt="Video thumbnail" 
                            className="rounded-lg w-full h-auto aspect-video object-cover shadow-sm"
                        />
                    )}
                </div>
                <div className="flex-grow py-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${isLocal ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {isLocal ? 'Tệp nội bộ' : 'YouTube'}
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900 mt-2">{metadata.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">Nguồn: {metadata.author_name}</p>
                    <div className="mt-4 flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Thời lượng</span>
                            <span className="text-sm font-semibold">{metadata.durationFormatted}</span>
                        </div>
                        {metadata.hasCaptions && (
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-bold">Phụ đề</span>
                                <CcIcon className="w-5 h-5 text-green-600" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoHeader;
