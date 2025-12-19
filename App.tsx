
import React, { useState, useCallback, useEffect } from 'react';
import UrlInputForm from './components/UrlInputForm';
import AnalysisView from './components/AnalysisView';
import {
    AnalysisState,
    GeminiAnalysisResponse,
    VideoMetadata,
    ChatMessage,
    LibraryEntry,
} from './types';
import { runAnalysis, QuotaError } from './services/analysisService';
import { startChat, sendChatMessage } from './services/geminiService';
import { fetchVideoMetadata, fetchFileMetadata } from './services/youtubeService';
import ApiKeyModal from './components/ApiKeyModal';
import AiChat from './components/AiChat';
import { LibraryItem } from './components/LibraryItem';
import * as idbService from './services/idbService';
import { TrashIcon } from './components/icons/TrashIcon';
import { LoadingSpinner } from './components/icons/LoadingSpinner';
import SettingsModal from './components/SettingsModal';
import { SettingsIcon } from './components/icons/SettingsIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';

type AppStatus = 'idle' | 'processing' | 'finished';

const App: React.FC = () => {
    const [appStatus, setAppStatus] = useState<AppStatus>('idle');
    const [library, setLibrary] = useState<LibraryEntry[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    
    const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResponse | null>(null);

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);

    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isQuotaModalOpen, setQuotaModalOpen] = useState(false);
    const [quotaPromiseResolve, setQuotaPromiseResolve] = useState<((key: string | null) => void) | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                await idbService.initDB();
                const history = await idbService.getHistory();
                setLibrary(history);
            } catch (err) {
                console.error(err);
            } finally {
                setIsHistoryLoading(false);
            }

            try {
                const storedKeys = localStorage.getItem('geminiApiKeys');
                if (storedKeys) setApiKeys(JSON.parse(storedKeys));
            } catch (err) {
                console.error(err);
            }
        }
        loadData();
    }, []);

    const handleReset = () => {
        setAppStatus('idle');
        setAnalysisState(null);
        setVideoMetadata(null);
        setAnalysisError(null);
        setAnalysisResult(null);
        setChatMessages([]);
    };

    const handleBatchAnalyze = useCallback(async (urls: string[], style: string, modelId: string, summaryDurationMinutes?: number, variationPrompt?: string, files?: File[]) => {
        if (apiKeys.length === 0) {
            alert("Vui lòng thêm API Key trước.");
            setSettingsModalOpen(true);
            return;
        }
        
        setAppStatus('processing');
        const initialEntries: LibraryEntry[] = [];
        
        // Handle URLs
        if (urls && urls.length > 0) {
            for (const url of urls) {
                try {
                    const meta = await fetchVideoMetadata(url);
                    initialEntries.push({
                        id: `${meta.videoId}-${crypto.randomUUID()}`,
                        url,
                        title: meta.title,
                        thumbnail_url: meta.thumbnail_url,
                        createdAt: Date.now(),
                        status: 'pending',
                        modelId
                    });
                } catch (e) {
                    console.error(e);
                }
            }
        }

        // Handle Files
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const meta = await fetchFileMetadata(file);
                    initialEntries.push({
                        id: meta.videoId,
                        url: `file://${file.name}`,
                        title: meta.title,
                        thumbnail_url: meta.thumbnail_url,
                        createdAt: Date.now(),
                        status: 'pending',
                        modelId,
                        isLocalFile: true,
                        localBlobUrl: meta.localBlobUrl
                    });
                } catch (e) {
                    console.error(e);
                }
            }
        }

        if (initialEntries.length === 0) {
            setAppStatus('idle');
            return;
        }

        setLibrary(prev => [...initialEntries, ...prev]);
        setBatchProgress({ current: 0, total: initialEntries.length });

        for (let i = 0; i < initialEntries.length; i++) {
            const entry = initialEntries[i];
            setBatchProgress(prev => ({ ...prev, current: i + 1 }));
            
            let currentMeta: VideoMetadata;
            if (entry.isLocalFile && entry.localBlobUrl) {
                currentMeta = {
                    videoId: entry.id,
                    title: entry.title,
                    thumbnail_url: entry.thumbnail_url,
                    author_name: "Tệp nội bộ",
                    hasCaptions: false,
                    duration: (entry.result?.video_meta.duration_sec) || 0, 
                    durationFormatted: 'N/A',
                    localBlobUrl: entry.localBlobUrl
                };
            } else {
                currentMeta = await fetchVideoMetadata(entry.url);
            }
            
            setVideoMetadata(currentMeta);
            setAnalysisState(null);
            setAnalysisError(null);
            setAnalysisResult(null);

            const processingEntry: LibraryEntry = { ...entry, status: 'processing' };
            setLibrary(prev => prev.map(item => item.id === entry.id ? processingEntry : item));

            try {
                await runAnalysis(
                    currentMeta, style, modelId, summaryDurationMinutes, variationPrompt, [...apiKeys],
                    (state) => setAnalysisState(state),
                    (result) => {
                        setAnalysisResult(result);
                        const completeEntry: LibraryEntry = { ...processingEntry, status: 'complete', completedAt: Date.now(), result };
                        setLibrary(prev => prev.map(item => item.id === entry.id ? completeEntry : item));
                        idbService.addHistoryEntry(completeEntry);
                        startChat(JSON.stringify(result), modelId);
                    },
                    async () => {
                        setQuotaModalOpen(true);
                        return new Promise(resolve => setQuotaPromiseResolve(() => resolve));
                    }
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Lỗi';
                setAnalysisError(errorMessage);
                const errorEntry: LibraryEntry = { ...processingEntry, status: 'error', error: errorMessage };
                setLibrary(prev => prev.map(item => item.id === entry.id ? errorEntry : item));
            }
        }
        setAppStatus('finished');
    }, [apiKeys]);

    const handleSendMessage = useCallback(async (message: string) => {
        setChatMessages(prev => [...prev, { sender: 'user', text: message }]);
        setIsChatLoading(true);
        try {
            const aiResponse = await sendChatMessage(message);
            setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
        } catch (error) {
            setChatMessages(prev => [...prev, { sender: 'ai', text: 'Lỗi khi gửi tin nhắn.' }]);
        } finally {
            setIsChatLoading(false);
        }
    }, []);

    return (
        <div className="bg-gray-100 text-gray-900 min-h-screen font-sans">
            <header className="p-4 border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl md:text-2xl font-black text-red-600 tracking-tighter">CF AI <span className="text-gray-400 font-light">V3</span></h1>
                        {appStatus !== 'idle' && (
                            <button 
                                onClick={handleReset}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-200"
                            >
                                <SparklesIcon className="w-3.5 h-3.5" />
                                PHÂN TÍCH MỚI
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSettingsModalOpen(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <SettingsIcon className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                {appStatus === 'idle' && (
                    <UrlInputForm onAnalyze={handleBatchAnalyze} isAnalyzing={false} apiKeys={apiKeys} />
                )}

                {appStatus !== 'idle' && (
                    <div className="space-y-8 animate-fade-in">
                         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                             <div className="flex justify-between items-end mb-2">
                                <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Tiến độ ({batchProgress.current}/{batchProgress.total})</h2>
                                <span className="text-xs font-bold text-red-600">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                             </div>
                             <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden border border-gray-200">
                                <div className="bg-gradient-to-r from-red-500 to-red-600 h-full transition-all duration-700 ease-out" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                            <div className="lg:col-span-3">
                                <AnalysisView analysisState={analysisState} videoMetadata={videoMetadata} error={analysisError} finalResult={analysisResult} />
                            </div>
                            <div className="lg:col-span-2 sticky top-24">
                                <AiChat messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isChatLoading} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-16 border-t border-gray-200 pt-8">
                     <div className="flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                        <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Lịch sử Phân tích</h2>
                     </div>
                     {isHistoryLoading ? (
                        <div className="flex justify-center p-12"><LoadingSpinner /></div>
                     ) : library.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {library.map((item) => <LibraryItem key={item.id} item={item} onDelete={(id) => {
                                setLibrary(prev => prev.filter(i => i.id !== id));
                                idbService.deleteHistoryEntry(id);
                            }} />)}
                        </div>
                     ) : <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400 font-medium">Chưa có dữ liệu phân tích nào.</div>}
                </div>
            </main>
            
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} onSave={(keys) => { setApiKeys(keys); localStorage.setItem('geminiApiKeys', JSON.stringify(keys)); }} initialKeys={apiKeys} />
            <ApiKeyModal isOpen={isQuotaModalOpen} onContinue={(key) => {
                setQuotaModalOpen(false);
                if (quotaPromiseResolve) quotaPromiseResolve(key);
            }} onCancel={() => {
                setQuotaModalOpen(false);
                if (quotaPromiseResolve) quotaPromiseResolve(null);
            }} />
        </div>
    );
};

export default App;
