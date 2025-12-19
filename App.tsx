
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
import { fetchVideoMetadata } from './services/youtubeService';
import ApiKeyModal from './components/ApiKeyModal';
import AiChat from './components/AiChat';
import { LibraryItem } from './components/LibraryItem';
import * as idbService from './services/idbService';
import { TrashIcon } from './components/icons/TrashIcon';
import { LoadingSpinner } from './components/icons/LoadingSpinner';
import SettingsModal from './components/SettingsModal';
import { SettingsIcon } from './components/icons/SettingsIcon';

type AppStatus = 'idle' | 'processing' | 'finished';

const App: React.FC = () => {
    const [appStatus, setAppStatus] = useState<AppStatus>('idle');
    const [library, setLibrary] = useState<LibraryEntry[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    
    // State for the currently processing video
    const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResponse | null>(null);


    // State for chat
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);

    // State for API Keys & Modals
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isQuotaModalOpen, setQuotaModalOpen] = useState(false);
    const [quotaPromiseResolve, setQuotaPromiseResolve] = useState<((key: string | null) => void) | null>(null);

    // Load history and API keys from storage on mount
    useEffect(() => {
        async function loadData() {
            // Load history
            try {
                await idbService.initDB();
                const history = await idbService.getHistory();
                setLibrary(history);
            } catch (err) {
                console.error("Failed to load history from IndexedDB:", err);
            } finally {
                setIsHistoryLoading(false);
            }

            // Load API keys
            try {
                const storedKeys = localStorage.getItem('geminiApiKeys');
                if (storedKeys) {
                    setApiKeys(JSON.parse(storedKeys));
                }
            } catch (err) {
                console.error("Failed to load API keys from localStorage:", err);
            }
        }
        loadData();
    }, []);

    const handleSaveApiKeys = (keys: string[]) => {
        setApiKeys(keys);
        try {
            localStorage.setItem('geminiApiKeys', JSON.stringify(keys));
        } catch (err) {
            console.error("Failed to save API keys to localStorage:", err);
        }
    };

    const handleBatchAnalyze = useCallback(async (urls: string[], style: string, modelId: string, summaryDurationMinutes?: number, variationPrompt?: string) => {
        if (apiKeys.length === 0) {
            alert("Vui lòng thêm ít nhất một API Key trong phần Cài đặt trước khi phân tích.");
            setSettingsModalOpen(true);
            return;
        }
        
        setAppStatus('processing');

        // Step 1: Create placeholder entries for all URLs
        const initialEntries: LibraryEntry[] = await Promise.all(
            urls.map(async (url) => {
                try {
                    const meta = await fetchVideoMetadata(url);
                    if (!meta.videoId) throw new Error('Could not get video metadata.');
                    return {
                        id: `${meta.videoId}-${crypto.randomUUID()}`,
                        url,
                        title: meta.title,
                        thumbnail_url: meta.thumbnail_url,
                        createdAt: Date.now(),
                        status: 'pending',
                        modelId: modelId
                    };
                } catch (e) {
                    return {
                        id: `failed-meta-${crypto.randomUUID()}`,
                        url: url,
                        title: "Không thể lấy siêu dữ liệu",
                        thumbnail_url: '',
                        createdAt: Date.now(),
                        completedAt: Date.now(),
                        status: 'error',
                        error: e instanceof Error ? e.message : 'URL không hợp lệ hoặc không thể truy cập.',
                    };
                }
            })
        );
        
        // Add all to library state and DB
        setLibrary(prev => [...initialEntries.sort((a,b) => b.createdAt - a.createdAt), ...prev]);
        for (const entry of initialEntries) {
            await idbService.addHistoryEntry(entry);
        }

        setBatchProgress({ current: 0, total: urls.length });

        // Step 2: Sequentially process each pending entry
        const entriesToProcess = initialEntries.filter(e => e.status !== 'error');
        let processedCount = initialEntries.length - entriesToProcess.length;

        for (const entry of entriesToProcess) {
            processedCount++;
            setBatchProgress({ current: processedCount, total: urls.length });
            
            // Reset per-video analysis state
            setAnalysisState(null);
            setAnalysisError(null);
            setAnalysisResult(null);
            const currentMeta = await fetchVideoMetadata(entry.url); // Re-fetch to be safe
            setVideoMetadata(currentMeta);

            // Mark as 'processing'
            const processingEntry: LibraryEntry = { ...entry, status: 'processing', createdAt: Date.now() };
            setLibrary(prev => prev.map(item => item.id === processingEntry.id ? processingEntry : item));
            await idbService.updateHistoryEntry(processingEntry);
            
            const handleAllKeysExhausted = (): Promise<string | null> => {
                return new Promise((resolve) => {
                    setQuotaModalOpen(true);
                    setQuotaPromiseResolve(() => (newKey: string | null) => {
                        if (newKey) {
                            // Add the new key to the list for future use
                            const updatedKeys = [...apiKeys, newKey];
                            handleSaveApiKeys(updatedKeys);
                        }
                        resolve(newKey);
                    });
                });
            };

            try {
                await runAnalysis(
                    entry.url, style, modelId, summaryDurationMinutes, variationPrompt, [...apiKeys], // Pass a copy of keys
                    (state) => setAnalysisState(state),
                    (result) => {
                        setAnalysisResult(result);
                        const completeEntry: LibraryEntry = {
                            ...processingEntry,
                            status: 'complete',
                            completedAt: Date.now(),
                            result,
                        };
                        idbService.updateHistoryEntry(completeEntry);
                        setLibrary(prev => prev.map(item => item.id === completeEntry.id ? completeEntry : item));
                        startChat(JSON.stringify(result), modelId);
                        setChatMessages([{ sender: 'ai', text: `Đã phân tích xong "${currentMeta.title}". Bạn muốn hỏi gì về video này?` }]);
                    },
                    handleAllKeysExhausted
                );
            } catch (error) {
                 const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định';
                 setAnalysisError(errorMessage);
                 console.error(`Failed to analyze ${entry.url}:`, error);

                 const errorEntry: LibraryEntry = {
                    ...processingEntry,
                    status: 'error',
                    completedAt: Date.now(),
                    error: (error instanceof QuotaError && error.message === 'USER_CANCELLED')
                        ? 'Phân tích đã bị hủy bởi người dùng.'
                        : errorMessage
                 };
                 idbService.updateHistoryEntry(errorEntry);
                 setLibrary(prev => prev.map(item => item.id === errorEntry.id ? errorEntry : item));
            } finally {
                setQuotaModalOpen(false);
                setQuotaPromiseResolve(null);
            }
        }
        setAppStatus('finished');
    }, [apiKeys]);

    const handleResumeAnalysis = (newKey: string) => {
        if (quotaPromiseResolve) {
            quotaPromiseResolve(newKey);
        }
    };

    const handleCancelAnalysisFromQuotaModal = () => {
         if (quotaPromiseResolve) {
            quotaPromiseResolve(null); // Resolve with null to signal cancellation
        }
        handleResetForNewAnalysis();
    }
    
    const handleSendMessage = useCallback(async (message: string) => {
        const lastSuccess = library.slice().find(item => item.status === 'complete');
        if (!lastSuccess) return;

        setChatMessages(prev => [...prev, { sender: 'user', text: message }]);
        setIsChatLoading(true);

        try {
            const aiResponse = await sendChatMessage(message);
            setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
            setChatMessages(prev => [...prev, { sender: 'ai', text: `Rất tiếc, đã xảy ra lỗi: ${errorMessage}` }]);
        } finally {
            setIsChatLoading(false);
        }
    }, [library]);
    
    const handleResetForNewAnalysis = () => {
        if (quotaPromiseResolve) {
            quotaPromiseResolve(null); 
        }
        setAppStatus('idle');
        setBatchProgress({ current: 0, total: 0 });
        setAnalysisState(null);
        setVideoMetadata(null);
        setChatMessages([]);
        setAnalysisError(null);
        setAnalysisResult(null);
        setQuotaModalOpen(false);
        setQuotaPromiseResolve(null);
    };

    const handleDeleteItem = async (id: string) => {
        try {
            await idbService.deleteHistoryEntry(id);
            setLibrary(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error("Failed to delete history item:", err);
        }
    };

    const handleClearHistory = async () => {
        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử phân tích không?")) {
            try {
                await idbService.clearHistory();
                setLibrary([]);
            } catch (err) {
                console.error("Failed to clear history:", err);
            }
        }
    };
    
    const pendingCount = library.filter(item => item.status === 'pending').length;

    return (
        <div className="bg-gray-100 text-gray-900 min-h-screen font-sans">
            <header className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-400">
                        Trình Phân Tích Video Ai by Đường Thọ - 0934415387
                    </h1>
                     <div className="flex items-center gap-4">
                        {appStatus !== 'idle' && (
                            <button 
                                onClick={handleResetForNewAnalysis}
                                className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-semibold rounded-md hover:bg-gray-300 transition-colors"
                            >
                               Phân tích danh sách khác
                            </button>
                        )}
                         <button 
                            onClick={() => setSettingsModalOpen(true)}
                            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
                            aria-label="Cài đặt API Keys"
                        >
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
                    <div className="space-y-8">
                        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
                             <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                Tiến trình hàng loạt
                             </h2>
                             {appStatus === 'processing' && (
                                <p className="text-gray-600">
                                    Đang xử lý video {batchProgress.current} trên {batchProgress.total}...
                                </p>
                             )}
                             {appStatus === 'finished' && (
                                 <p className="text-green-700 font-medium">
                                    Đã hoàn tất xử lý {batchProgress.total} video.
                                </p>
                             )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                            <div className="lg:col-span-3 space-y-4">
                                 <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-2">
                                    Phân tích video hiện tại
                                 </h2>
                                <AnalysisView
                                    analysisState={analysisState}
                                    videoMetadata={videoMetadata}
                                    error={analysisError}
                                    finalResult={analysisResult}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <div className="sticky top-24">
                                   <AiChat 
                                        messages={chatMessages}
                                        onSendMessage={handleSendMessage}
                                        isLoading={isChatLoading || library.length === 0}
                                   />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="mt-12">
                     <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-semibold text-gray-800">Lịch sử Phân tích</h2>
                            {pendingCount > 0 && (
                                <span className="bg-gray-200 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full">
                                    {pendingCount} đang chờ
                                </span>
                            )}
                        </div>
                        {library.length > 0 && (
                            <button 
                                onClick={handleClearHistory}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-300 transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Xóa lịch sử
                            </button>
                        )}
                     </div>
                     {isHistoryLoading ? (
                        <div className="text-center py-8">
                            <LoadingSpinner className="w-8 h-8 mx-auto" />
                            <p className="mt-2 text-gray-500">Đang tải lịch sử...</p>
                        </div>
                     ) : library.length > 0 ? (
                        <div className="space-y-3">
                            {library.map((item) => <LibraryItem key={item.id} item={item} onDelete={handleDeleteItem} />)}
                        </div>
                     ) : (
                        <div className="text-center py-8 bg-white border border-dashed border-gray-300 rounded-lg">
                            <p className="text-gray-500">Chưa có lịch sử phân tích.</p>
                            <p className="text-xs text-gray-400 mt-1">Các video bạn phân tích sẽ xuất hiện ở đây.</p>
                        </div>
                     )}
                </div>
            </main>

             <footer className="text-center p-4 text-xs text-gray-500 border-t border-gray-200 mt-8">
                Bản quyền của Đường Thọ
            </footer>

             <ApiKeyModal
                isOpen={isQuotaModalOpen}
                onContinue={handleResumeAnalysis}
                onCancel={handleCancelAnalysisFromQuotaModal}
            />
             <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                onSave={handleSaveApiKeys}
                initialKeys={apiKeys}
            />
        </div>
    );
};

export default App;
