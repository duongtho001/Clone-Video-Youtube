import React, { useState, useEffect } from 'react';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { generateStoryIdeas } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface UrlInputFormProps {
    onAnalyze: (urls: string[], style: string, summaryDurationMinutes?: number, variationPrompt?: string) => void;
    isAnalyzing: boolean;
    apiKeys: string[];
}

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}(&\S*)?$/;

const UrlInputForm: React.FC<UrlInputFormProps> = ({ onAnalyze, isAnalyzing, apiKeys }) => {
    const [urls, setUrls] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [style, setStyle] = useState('cinematic');
    
    // Summary duration state
    const [summaryDuration, setSummaryDuration] = useState('');

    // Variation mode state
    const [isVariationMode, setIsVariationMode] = useState(false);
    const [variationPrompt, setVariationPrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isAnalyzing) return;

        const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);

        if (urlList.length === 0) {
            setError('Vui lòng nhập ít nhất một URL YouTube.');
            return;
        }

        const invalidUrls = urlList.filter(u => !YOUTUBE_URL_REGEX.test(u));
        if (invalidUrls.length > 0) {
            setError(`Các URL sau không hợp lệ:\n${invalidUrls.join('\n')}\nVui lòng sửa lại.`);
            return;
        }
        
        if (urlList.length > 1 && isVariationMode) {
             setError('Chế độ "Tạo biến thể câu chuyện" chỉ hỗ trợ một URL tại một thời điểm.');
             return;
        }
        
        const duration = summaryDuration ? parseInt(summaryDuration, 10) : undefined;
        if (summaryDuration && (!duration || duration <= 0)) {
            setError('Vui lòng nhập độ dài video hợp lệ (số phút > 0).');
            return;
        }

        if (isVariationMode && !variationPrompt.trim()) {
            setError('Vui lòng nhập ý tưởng cho câu chuyện mới hoặc nhận gợi ý từ AI.');
            return;
        }
        
        setError(null);
        onAnalyze(urlList, style, isVariationMode ? undefined : duration, isVariationMode ? variationPrompt : undefined);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUrls(e.target.value);
        if (error) setError(null);
        if (suggestionError) setSuggestionError(null);
        setSuggestions([]);
    };
    
    const handleGenerateSuggestions = async () => {
        if (apiKeys.length === 0) {
            setSuggestionError('Vui lòng thêm API Key trong phần Cài đặt để sử dụng tính năng này.');
            return;
        }
        const firstUrl = urls.split('\n').map(u => u.trim()).find(Boolean);
        if (!firstUrl || !YOUTUBE_URL_REGEX.test(firstUrl)) {
            setSuggestionError('Vui lòng nhập một URL YouTube hợp lệ vào dòng đầu tiên để nhận gợi ý.');
            return;
        }
        setIsSuggesting(true);
        setSuggestionError(null);
        setSuggestions([]);
        try {
            const ideas = await generateStoryIdeas(firstUrl, apiKeys);
            setSuggestions(ideas);
        } catch (err) {
            setSuggestionError(err instanceof Error ? err.message : 'Không thể tạo gợi ý.');
        } finally {
            setIsSuggesting(false);
        }
    };

    // When variation mode is enabled, clear summary duration.
    useEffect(() => {
        if (isVariationMode) {
            setSummaryDuration('');
        }
    }, [isVariationMode]);


    return (
        <div className="w-full max-w-2xl mx-auto space-y-8">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-200">
                <div className="pb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <YouTubeIcon className="w-8 h-8 text-red-500" />
                        <label htmlFor="youtube-url" className="text-xl font-semibold text-gray-900">
                            Phân Tích Video YouTube
                        </label>
                    </div>
                    <div className="space-y-4">
                         <div>
                            <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-600 mb-1">Danh sách URL Video (mỗi URL một dòng)</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                 <textarea
                                    id="youtube-url"
                                    rows={4}
                                    value={urls}
                                    onChange={handleUrlChange}
                                    placeholder="Dán một hoặc nhiều URL YouTube tại đây, mỗi URL trên một dòng..."
                                    className={`flex-grow bg-gray-50 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-500 outline-none transition-colors`}
                                    disabled={isAnalyzing}
                                />
                                <button
                                    type="submit"
                                    disabled={isAnalyzing}
                                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isAnalyzing ? 'Đang phân tích...' : 'Phân Tích'}
                                </button>
                            </div>
                             <p className="text-xs text-gray-500 mt-2">
                                Ví dụ: https://www.youtube.com/watch?v=dQw4w9WgXcQ
                            </p>
                        </div>

                        <div>
                            <label htmlFor="output-style" className="block text-sm font-medium text-gray-600 mb-1">Phong cách đầu ra</label>
                            <select
                                id="output-style"
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none transition-colors"
                                disabled={isAnalyzing}
                            >
                                <option value="cinematic">Điện ảnh (Cinematic)</option>
                                <option value="anime">Hoạt hình (Anime)</option>
                                <option value="documentary">Tài liệu (Documentary)</option>
                                <option value="black-and-white-film">Phim trắng đen</option>
                                <option value="minecraft">Minecraft</option>
                                <option value="3d">Hoạt hình 3D</option>
                                <option value="2d">Hoạt hình 2D</option>
                                <option value="japanese-1980s">Hoạt hình Nhật Bản 1980s</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="summary-duration" className="block text-sm font-medium text-gray-600 mb-1">Độ dài video mong muốn (phút)</label>
                            <input
                                id="summary-duration"
                                type="number"
                                value={summaryDuration}
                                onChange={(e) => setSummaryDuration(e.target.value)}
                                placeholder="Để trống để phân tích toàn bộ video gốc"
                                className="w-full bg-gray-50 border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none disabled:bg-gray-200 disabled:cursor-not-allowed"
                                min="1"
                                disabled={isAnalyzing || isVariationMode}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Nếu được cung cấp, AI sẽ tạo một kịch bản tóm tắt video với độ dài này.
                            </p>
                        </div>
                    </div>
                </div>
                 
                {/* Analysis Mode Toggles */}
                <div className="py-6 space-y-4">
                    <div className="relative flex items-start">
                        <div className="flex h-6 items-center">
                            <input
                                id="variation-mode"
                                name="variation-mode"
                                type="checkbox"
                                checked={isVariationMode}
                                onChange={(e) => setIsVariationMode(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                disabled={isAnalyzing}
                            />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                            <label htmlFor="variation-mode" className="font-medium text-gray-900">
                                Tạo biến thể câu chuyện
                            </label>
                            <p className="text-gray-500">
                                Viết một câu chuyện hoàn toàn mới dựa trên nhân vật của video gốc.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Conditional Inputs */}
                <div className="pt-6">
                    {isVariationMode && (
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="variation-prompt" className="text-sm font-medium text-gray-600 mb-1 flex justify-between items-center">
                                    <span>Ý tưởng cho câu chuyện mới</span>
                                     <button
                                        type="button"
                                        onClick={handleGenerateSuggestions}
                                        disabled={isSuggesting || isAnalyzing || !urls.trim()}
                                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-red-600 rounded-md hover:bg-red-50 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed"
                                    >
                                        {isSuggesting ? <LoadingSpinner className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                        {isSuggesting ? 'Đang tạo...' : 'Gợi ý bằng AI'}
                                    </button>
                                </label>
                                <textarea
                                    id="variation-prompt"
                                    rows={3}
                                    value={variationPrompt}
                                    onChange={(e) => setVariationPrompt(e.target.value)}
                                    placeholder="ví dụ: Alex và Steve tìm thấy một bản đồ kho báu và bắt đầu cuộc phiêu lưu đến một hòn đảo bí ẩn..."
                                    className="w-full bg-gray-50 border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                                    disabled={isAnalyzing}
                                />
                            </div>
                            {suggestionError && <p className="text-red-600 text-xs">{suggestionError}</p>}
                            {suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.map((idea, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setVariationPrompt(idea)}
                                            className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full hover:bg-red-200 transition-colors"
                                        >
                                            {idea}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {error && <p className="text-red-600 text-sm pt-4 whitespace-pre-wrap">{error}</p>}
               
            </form>
        </div>
    );
};

export default UrlInputForm;
