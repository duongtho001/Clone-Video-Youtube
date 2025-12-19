
import { GoogleGenAI, Type } from "@google/genai";
import {
    AnalysisState,
    StepStatus,
    GeminiAnalysisResponse,
    KeyframeOutput,
    VideoMetadata,
    GeminiScene,
    StoryOutline,
    GeminiAsset,
} from '../types';

export class QuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QuotaError';
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h > 0 ? h : null, m, s]
        .filter(x => x !== null)
        .map(x => String(x).padStart(2, '0'))
        .join(':');
};

const storyOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A creative title for the story." },
        logline: { type: Type.STRING, description: "A one-sentence summary of the entire story." },
        parts: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    part_id: { type: Type.INTEGER },
                    title: { type: Type.STRING, description: "Title for this part." },
                    summary: { type: Type.STRING, description: "Detailed summary of this part." },
                    start_time: { type: Type.STRING, description: "Start timestamp 'mm:ss'." },
                    end_time: { type: Type.STRING, description: "End timestamp 'mm:ss'." },
                },
                required: ['part_id', 'title', 'summary', 'start_time', 'end_time']
            }
        }
    },
    required: ['title', 'logline', 'parts']
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        video_meta: {
            type: Type.OBJECT,
            properties: {
                url: { type: Type.STRING },
                title: { type: Type.STRING },
                duration_sec: { type: Type.NUMBER },
                style: {
                    type: Type.OBJECT,
                    properties: {
                        mood: { type: Type.STRING },
                        palette: { type: Type.ARRAY, items: { type: Type.STRING } },
                        music: { type: Type.STRING }
                    },
                    required: ['mood', 'palette', 'music']
                }
            },
            required: ['url', 'title', 'duration_sec', 'style']
        },
        scenes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    scene_id: { type: Type.INTEGER },
                    t0: { type: Type.STRING },
                    t1: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    CAM: { type: Type.STRING },
                    SUBJ: { type: Type.STRING },
                    SET: { type: Type.STRING },
                    MOOD: { type: Type.STRING },
                    FX: { type: Type.STRING },
                    CLR: { type: Type.STRING },
                    SND: { type: Type.STRING },
                    EDIT: { type: Type.STRING },
                    RNDR: { type: Type.STRING },
                    '!FOCAL': { type: Type.STRING },
                    TIM: { type: Type.STRING },
                    title: { type: Type.STRING },
                    style_video: { type: Type.STRING }
                },
                required: [
                    'scene_id', 't0', 't1', 'summary', 'CAM', 'SUBJ', 'SET', 'MOOD', 'FX', 
                    'CLR', 'SND', 'EDIT', 'RNDR', '!FOCAL', 'TIM', 'title', 'style_video'
                ]
            }
        },
        assets: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ['id', 'type', 'description']
            }
        }
    },
    required: ['video_meta', 'scenes', 'assets']
};

const getErrorMessage = (error: any): string => {
    if (!error) return 'unknown';
    if (typeof error === 'string') return error.toLowerCase();
    if (error instanceof Error) return error.message.toLowerCase();
    return JSON.stringify(error).toLowerCase();
};

const sanitizeJsonString = (rawString: string): string => {
    const trimmed = rawString.trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return (match && match[1]) ? match[1] : trimmed;
};

const generateAndParseJsonWithRetry = async <T>(
    ai: GoogleGenAI, 
    modelId: string,
    prompt: string,
    schema: any,
    maxRetries: number,
    onRetry: (attempt: number, delay: number, reason: string) => void
): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.min(30000, 3000 * Math.pow(2, attempt - 1) + Math.random() * 1000);
                onRetry(attempt, delay, getErrorMessage(lastError));
                await sleep(delay);
            }
            const response = await ai.models.generateContent({
                model: modelId,
                contents: prompt,
                config: { responseMimeType: 'application/json', responseSchema: schema }
            });
            const text = response.text;
            if (!text) throw new Error("Empty AI response");
            return JSON.parse(sanitizeJsonString(text)) as T;
        } catch (error: any) {
            lastError = error;
            const msg = getErrorMessage(error);
            if (msg.includes('quota') || msg.includes('429')) throw new QuotaError("Quota reached");
            if (!msg.includes('503') && !msg.includes('unavailable') && !msg.includes('overloaded')) throw error;
        }
    }
    throw new Error(`AI error after ${maxRetries} retries: ${getErrorMessage(lastError)}`);
};

export const runAnalysis = async (
    metadata: VideoMetadata,
    style: string,
    modelId: string,
    outputDurationMinutes: number | undefined,
    variationPrompt: string | undefined,
    apiKeys: string[],
    onStateUpdate: (state: AnalysisState) => void,
    onComplete: (result: GeminiAnalysisResponse) => void,
    onAllKeysExhausted: () => Promise<string | null>
) => {
    let currentState: AnalysisState = {
        currentStep: 0,
        steps: [
            { title: "Siêu dữ liệu Video", status: StepStatus.PENDING, output: '', error: null },
            { title: "Tải Video (Mô phỏng)", status: StepStatus.PENDING, output: '', error: null },
            { title: "Detect Cảnh quay", status: StepStatus.PENDING, output: '', error: null },
            { title: "Trích xuất Keyframe", status: StepStatus.PENDING, output: '', error: null },
            { title: "Dàn ý Kịch bản (AI)", status: StepStatus.PENDING, output: '', error: null },
            { title: "Chi tiết Cảnh quay (AI)", status: StepStatus.PENDING, output: '', error: null },
            { title: "Cấu trúc JSON", status: StepStatus.PENDING, output: '', error: null },
            { title: "Final Prompts", status: StepStatus.PENDING, output: '', error: null },
        ],
    };

    const updateStep = (idx: number, status: StepStatus, output?: any, error?: string) => {
        currentState = { ...currentState };
        currentState.steps[idx] = { ...currentState.steps[idx], status, output: output || currentState.steps[idx].output, error: error || null };
        if (status === StepStatus.PROCESSING) currentState.currentStep = idx;
        else if (status === StepStatus.COMPLETE && idx < currentState.steps.length - 1) {
            currentState.currentStep = idx + 1;
            currentState.steps[idx + 1].status = StepStatus.PROCESSING;
        }
        onStateUpdate(currentState);
    };

    try {
        if (!apiKeys.length) throw new Error("Thiếu API Key.");
        let currentKeyIdx = 0;
        let ai = new GoogleGenAI({ apiKey: apiKeys[currentKeyIdx] });

        updateStep(0, StepStatus.PROCESSING, JSON.stringify(metadata, null, 2));
        updateStep(0, StepStatus.COMPLETE);

        updateStep(1, StepStatus.PROCESSING, "Đang chuẩn bị dữ liệu video...");
        await sleep(500);
        updateStep(1, StepStatus.COMPLETE);

        const isVariation = !!variationPrompt?.trim();
        const isSummary = !!(outputDurationMinutes && outputDurationMinutes > 0);
        
        const targetDurationSeconds = isSummary ? (outputDurationMinutes! * 60) : (metadata.duration > 0 ? metadata.duration : 300);
        
        updateStep(2, StepStatus.PROCESSING, `Mục tiêu thời lượng: ${formatTime(targetDurationSeconds)}`);
        await sleep(500);
        
        // Tăng mật độ cảnh: 5 giây một cảnh để đảm bảo video 3 phút có ít nhất 36 cảnh
        const density = 5; 
        const sceneCount = Math.max(10, Math.ceil(targetDurationSeconds / density));
        updateStep(2, StepStatus.COMPLETE, `Phát hiện khoảng ${sceneCount} cảnh tiềm năng để bao phủ ${formatTime(targetDurationSeconds)}.`);

        updateStep(3, StepStatus.PROCESSING, "Đang trích xuất keyframe...");
        await sleep(500);
        updateStep(3, StepStatus.COMPLETE, { log: "Keyframes prepared.", keyframes: [] });

        updateStep(4, StepStatus.PROCESSING, "AI đang lập dàn ý cốt truyện...");
        const outlinePrompt = `
        VIDEO: ${metadata.title}
        TARGET DURATION: ${formatTime(targetDurationSeconds)}
        MODE: ${isVariation ? 'NEW STORY VARIATION' : isSummary ? 'SUMMARY' : 'FULL ANALYSIS'}
        USER IDEA: ${variationPrompt || 'N/A'}

        Nhiệm vụ: Tạo dàn ý cốt truyện JSON chia video thành 6-8 phần logic. 
        QUAN TRỌNG: Các mốc thời gian (start_time và end_time) của các phần cộng lại PHẢI chính xác bằng ${formatTime(targetDurationSeconds)}. 
        Phần đầu tiên bắt đầu lúc 00:00 và phần cuối kết thúc đúng lúc ${formatTime(targetDurationSeconds)}.
        Phải tạo ít nhất 6 phần để đảm bảo độ chi tiết.
        `;
        
        const storyOutline = await generateAndParseJsonWithRetry<StoryOutline>(ai, modelId, outlinePrompt, storyOutlineSchema, 3, (a, d) => {});
        updateStep(4, StepStatus.COMPLETE, JSON.stringify(storyOutline, null, 2));

        updateStep(5, StepStatus.PROCESSING);
        const CHUNK_SIZE = 120; // Xử lý từng đoạn 2 phút để AI không bị quá tải và tạo được nhiều cảnh hơn
        const numChunks = Math.max(1, Math.ceil(targetDurationSeconds / CHUNK_SIZE));
        let finalJson: GeminiAnalysisResponse | null = null;
        const allAssets = new Map<string, GeminiAsset>();

        for (let i = 0; i < numChunks; i++) {
            const tStart = i * CHUNK_SIZE;
            const tEnd = Math.min((i + 1) * CHUNK_SIZE, targetDurationSeconds);
            const chunkDuration = tEnd - tStart;
            if (chunkDuration <= 0 && i > 0) continue;

            const scenesForThisChunk = Math.ceil(chunkDuration / density); 

            const prompt = `
            PHÂN TÍCH ĐOẠN VIDEO: ${formatTime(tStart)} ĐẾN ${formatTime(tEnd)} (Tổng ${chunkDuration} giây)
            MỤC TIÊU PHONG CÁCH: ${style}
            BỐI CẢNH DÀN Ý: ${storyOutline.logline}
            
            YÊU CẦU CHI TIẾT:
            1. Tạo chính xác ${scenesForThisChunk} cảnh quay (Scenes) cho đoạn này. Mỗi cảnh trung bình dài 4-6 giây.
            2. Mốc thời gian (t0 và t1) PHẢI liên tục, nối tiếp nhau 100% không có kẽ hở.
            3. Tổng thời lượng các cảnh trong JSON PHẢI bao phủ toàn bộ từ ${formatTime(tStart)} đến ${formatTime(tEnd)}.
            4. Style: "${style}". Nội dung sáng tạo, giàu hình ảnh, an toàn.
            `;
            
            let chunkData: GeminiAnalysisResponse | null = null;
            let success = false;
            while (!success) {
                try {
                    chunkData = await generateAndParseJsonWithRetry<GeminiAnalysisResponse>(ai, modelId, prompt, responseSchema, 3, (a, d, r) => {
                        updateStep(5, StepStatus.PROCESSING, `Đoạn ${i+1}/${numChunks}: Thử lại do ${r}...`);
                    });
                    success = true;
                } catch (e) {
                    if (e instanceof QuotaError && ++currentKeyIdx < apiKeys.length) {
                        ai = new GoogleGenAI({ apiKey: apiKeys[currentKeyIdx] });
                        continue;
                    }
                    throw e;
                }
            }

            if (chunkData) {
                if (!finalJson) {
                    finalJson = chunkData;
                    finalJson.video_meta.title = storyOutline.title || metadata.title;
                    finalJson.video_meta.duration_sec = targetDurationSeconds;
                } else {
                    finalJson.scenes.push(...chunkData.scenes);
                }
                chunkData.assets?.forEach(a => {
                    if (a.id) allAssets.set(a.id, a);
                });
            }
        }

        if (!finalJson || !finalJson.scenes.length) throw new Error("AI không trả về kết quả phân tích cảnh.");

        finalJson.assets = Array.from(allAssets.values());
        finalJson.story_outline = storyOutline;
        
        finalJson.scenes.sort((a,b) => (a.t0||'').localeCompare(b.t0||''));
        finalJson.scenes.forEach((s, idx) => s.scene_id = idx + 1);

        updateStep(5, StepStatus.COMPLETE, `Đã tạo tổng cộng ${finalJson.scenes.length} cảnh quay chi tiết.`);
        updateStep(6, StepStatus.COMPLETE, JSON.stringify(finalJson, null, 2));
        updateStep(7, StepStatus.COMPLETE, "Tất cả kịch bản và prompt đã sẵn sàng.");
        onComplete(finalJson);

    } catch (error) {
        console.error(error);
        const errStep = currentState.currentStep;
        updateStep(errStep, StepStatus.ERROR, null, getErrorMessage(error));
    }
};
