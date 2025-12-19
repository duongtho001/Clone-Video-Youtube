
import React, { useState, useEffect, useRef } from 'react';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { generateStoryIdeas } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface UrlInputFormProps {
    onAnalyze: (urls: string[], style: string, modelId: string, summaryDurationMinutes?: number, variationPrompt?: string, files?: File[]) => void;
    isAnalyzing: boolean;
    apiKeys: string[];
}

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}(\S*)?$/;

const GEMINI_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview (Mạnh nhất)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (Mặc định)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
];

const UrlInputForm: React.FC<UrlInputFormProps> = ({ onAnalyze, isAnalyzing, apiKeys }) => {
    const [mode, setMode] = useState<'url' | 'file'>('url');
    const [urls, setUrls] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [style, setStyle] = useState('cinematic');
    const [modelId, setModelId] = useState('gemini-3-flash-preview');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [summaryDuration, setSummaryDuration] = useState('');
    const [isVariationMode, setIsVariationMode] = useState(false);
    const [variationPrompt, setVariationPrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isAnalyzing) return;

        const duration = summaryDuration ? parseInt(summaryDuration, 10) : undefined;

        if (mode === 'url') {
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
            onAnalyze(urlList, style, modelId, isVariationMode ? undefined : duration, isVariationMode ? variationPrompt : undefined);
        } else {
            if (files.length === 0) {
                setError('Vui lòng chọn ít nhất một tệp video.');
                return;
            }
             onAnalyze([], style, modelId, isVariationMode ? undefined : duration, isVariationMode ? variationPrompt : undefined, files);
        }
        setError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            if (error) setError(null);
        }
    };

    const handleGenerateSuggestions = async () => {
        if (!apiKeys.length) {
            setSuggestionError('Vui lòng thêm API Key trong phần Cài đặt.');
            return;
        }
        setIsSuggesting(true);
        setSuggestionError(null);
        setSuggestions([]);
        try {
            let context = mode === 'url' ? urls.split('\n')[0] : (files[0]?.name || '');
            if (!context) throw new Error("Cần Video hoặc URL để gợi ý.");
            const ideas = await generateStoryIdeas(context, apiKeys, modelId);
            setSuggestions(ideas);
        } catch (err: any) {
            setSuggestionError(err.message);
        } finally {
            setIsSuggesting(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${mode === 'url' ? 'bg-red-50' : 'bg-blue-50'}`}>
                                {mode === 'url' ? <YouTubeIcon className="w-6 h-6 text-red-600" /> : <ClipboardIcon className="w-6 h-6 text-blue-600" />}
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">Phân Tích Video</h2>
                        </div>
                        <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                            <button type="button" onClick={() => setMode('url')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'url' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:bg-gray-200'}`}>LINK</button>
                            <button type="button" onClick={() => setMode('file')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'file' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>TỆP</button>
                        </div>
                    </div>

                    {mode === 'url' ? (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Link YouTube</label>
                            <textarea
                                rows={3}
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                placeholder="Dán link vào đây..."
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                disabled={isAnalyzing}
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Tải video lên</label>
                            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 cursor-pointer transition-all">
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="video/*" className="hidden" />
                                <p className="text-sm text-gray-600 font-medium">{files.length ? `Đã chọn ${files.length} tệp` : 'Click để chọn video'}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Model AI</label>
                            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500">
                                {GEMINI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Phong cách</label>
                            <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500">
                                <option value="cinematic">Điện ảnh</option>
                                <option value="anime">Hoạt hình</option>
                                <option value="minecraft">Minecraft</option>
                                <option value="3d">Hoạt hình 3D</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Thời lượng tóm tắt (phút)</label>
                        <input
                            type="number"
                            value={summaryDuration}
                            onChange={(e) => setSummaryDuration(e.target.value)}
                            placeholder="Để trống để lấy toàn bộ gốc"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                            disabled={isVariationMode || isAnalyzing}
                        />
                    </div>
                </div>

                <div className="p-6 space-y-6 bg-gray-50/50">
                    <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <input
                            id="v-mode"
                            type="checkbox"
                            checked={isVariationMode}
                            onChange={(e) => setIsVariationMode(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded text-red-600 focus:ring-red-500"
                        />
                        <div className="flex-grow">
                            <label htmlFor="v-mode" className="text-sm font-bold text-gray-800 cursor-pointer">Chế độ Tạo Biến Thể</label>
                            <p className="text-xs text-gray-500 mt-1">Viết kịch bản mới hoàn toàn từ tư liệu cũ.</p>
                            
                            {isVariationMode && (
                                <div className="mt-4 space-y-3 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ý tưởng của bạn</label>
                                        <button type="button" onClick={handleGenerateSuggestions} disabled={isSuggesting} className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700">
                                            {isSuggesting ? <LoadingSpinner className="w-3 h-3" /> : <SparklesIcon className="w-3 h-3" />}
                                            Gợi ý AI
                                        </button>
                                    </div>
                                    <textarea
                                        rows={2}
                                        value={variationPrompt}
                                        onChange={(e) => setVariationPrompt(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                        placeholder="Nhập ý tưởng biến thể..."
                                    />
                                    {suggestions.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {suggestions.map((s, i) => (
                                                <button key={i} type="button" onClick={() => setVariationPrompt(s)} className="px-3 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded-full border border-red-100 hover:bg-red-100 transition-all">{s}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isAnalyzing}
                        className={`w-full py-4 rounded-xl text-white font-black text-lg shadow-xl transform transition-all active:scale-[0.98] ${isAnalyzing ? 'bg-gray-400 cursor-not-allowed' : (mode === 'url' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')}`}
                    >
                        {isAnalyzing ? <div className="flex items-center justify-center gap-2"><LoadingSpinner className="w-6 h-6 text-white" /> ĐANG PHÂN TÍCH...</div> : 'BẮT ĐẦU PHÂN TÍCH'}
                    </button>
                </div>
                {error && <div className="px-6 py-4 bg-red-50 text-red-700 text-sm font-bold text-center">{error}</div>}
            </form>
        </div>
    );
};

export default UrlInputForm;
