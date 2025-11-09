// Fix: Removed GeminiAsset from this import as it's not exported from @google/genai.
import { GoogleGenAI, Type } from "@google/genai";
import {
    AnalysisState,
    StepStatus,
    GeminiAnalysisResponse,
    KeyframeOutput,
    VideoMetadata,
    GeminiScene,
    StoryOutline,
    // Fix: Added GeminiAsset to this import from the local types definition.
    GeminiAsset,
} from '../types';
import { fetchVideoMetadata } from './youtubeService';

// Custom error for handling quota issues specifically.
export class QuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QuotaError';
    }
}


// Helper for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substr(14, 5);


const storyOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A creative title for the new or summarized story." },
        logline: { type: Type.STRING, description: "A one-sentence summary of the entire story." },
        parts: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    part_id: { type: Type.INTEGER },
                    title: { type: Type.STRING, description: "Title for this part of the story (e.g., 'The Discovery', 'The Confrontation')." },
                    summary: { type: Type.STRING, description: "A short paragraph summarizing the key events of this part." },
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
                url: { type: Type.STRING, description: "The original YouTube video URL." },
                title: { type: Type.STRING, description: "The title of the video. In variation mode, create a new title for the new story." },
                duration_sec: { type: Type.NUMBER, description: "The total duration of the video in seconds." },
                style: {
                    type: Type.OBJECT,
                    properties: {
                        mood: { type: Type.STRING, description: "The overall mood or feeling of the video." },
                        palette: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "A list of dominant colors in the video's color palette."
                        },
                        music: { type: Type.STRING, description: "A description of the suggested background music style." }
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
                    scene_id: { type: Type.INTEGER, description: "A unique sequential identifier for the scene within this chunk, starting from 1." },
                    t0: { type: Type.STRING, description: "Start timestamp of the scene in 'mm:ss' format." },
                    t1: { type: Type.STRING, description: "End timestamp of the scene in 'mm:ss' format." },
                    summary: { type: Type.STRING, description: "A concise summary of the action in the scene." },
                    CAM: { type: Type.STRING, description: "Cinematic term for the camera shot type (e.g., 'Medium Shot', 'Dolly Zoom')." },
                    SUBJ: { type: Type.STRING, description: "The main subject of the shot (e.g., 'A character looking sad')." },
                    SET: { type: Type.STRING, description: "The setting or location of the scene (e.g., 'A dark, moody forest at night')." },
                    MOOD: { type: Type.STRING, description: "The emotional mood of the scene (e.g., 'Suspenseful', 'Joyful')." },
                    FX: { type: Type.STRING, description: "Description of any visual or special effects (e.g., 'Slow motion', 'Lens flare')." },
                    CLR: { type: Type.STRING, description: "The color palette for the scene (e.g., 'Desaturated blues and grays')." },
                    SND: { type: Type.STRING, description: "Sound design, including ambient sounds and music suggestions (e.g., 'Footsteps echoing, tense orchestral score')." },
                    EDIT: { type: Type.STRING, description: "The editing style for the scene (e.g., 'Fast-paced cuts', 'Long take')." },
                    RNDR: { type: Type.STRING, description: "The desired render or artistic style (e.g., 'Photorealistic', 'Cel-shaded')." },
                    '!FOCAL': { type: Type.STRING, description: "The camera's focal length (e.g., 'Wide-angle 24mm', 'Telephoto 200mm')." },
                    TIM: { type: Type.STRING, description: "The time of day in the scene (e.g., 'Golden hour', 'Midnight')." },
                    title: { type: Type.STRING, description: "A short, descriptive title for the scene." },
                    style_video: { type: Type.STRING, description: "The overall video output style (e.g., 'cinematic', 'anime'). Must match the user's requested style." }
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
                    id: { type: Type.STRING, description: "A unique identifier for the asset (e.g., 'character_alex')." },
                    type: { type: Type.STRING, description: "The type of asset: 'character', 'location', or 'prop'." },
                    description: { type: Type.STRING, description: "A detailed description of the asset for generation." }
                },
                required: ['id', 'type', 'description']
            }
        }
    },
    required: ['video_meta', 'scenes', 'assets']
};

const getErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred.';
    
    // If error is a string, try to parse it as JSON first
    if (typeof error === 'string') {
        try {
            // Avoid parsing if it's not a JSON-like string
            if (error.trim().startsWith('{') || error.trim().startsWith('[')) {
                 const parsedError = JSON.parse(error);
                // If parsing succeeds, recursively call getErrorMessage with the object
                return getErrorMessage(parsedError);
            }
        } catch (e) {
            // Not a JSON string, treat as a regular message
        }
        return error.toLowerCase();
    }
    
    // If it's an Error object, return its message
    if (error instanceof Error) return error.message.toLowerCase();

    // If it's an object, look for a message property
    if (typeof error === 'object' && error !== null) {
        if (error.error?.message && typeof error.error.message === 'string') {
            return error.error.message.toLowerCase();
        }
        if (error.message && typeof error.message === 'string') {
            return error.message.toLowerCase();
        }
        // Fallback to stringifying the object if no message property is found
        try {
            return JSON.stringify(error).toLowerCase();
        } catch {
            return 'unserializable error object';
        }
    }
    
    // Fallback for other types
    return `unknown error type: ${typeof error}`;
}

const generateAndParseJsonWithRetry = async <T>(
    ai: GoogleGenAI, 
    prompt: string,
    schema: any,
    maxRetries: number,
    onRetry: (attempt: number, delay: number, reason: string) => void
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                // Exponential backoff with jitter, capped at 30 seconds.
                const backoff = 3000 * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 1000;
                const delay = Math.min(30000, backoff + jitter);
                const reason = getErrorMessage(lastError);
                onRetry(attempt, delay, reason);
                await sleep(delay);
            }
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                }
            });

            const rawJsonResponse = response.text;
            if (!rawJsonResponse) {
                lastError = new Error("AI returned an empty response.");
                continue;
            }

            try {
                const sanitizedJson = sanitizeJsonString(rawJsonResponse);
                return JSON.parse(sanitizedJson) as T; // SUCCESS
            } catch (parseError: any) {
                 console.warn(`JSON parse error on attempt ${attempt + 1}:`, parseError);
                 console.warn(`Raw response:`, rawJsonResponse);
                 lastError = new Error("Invalid JSON response from AI.");
                 continue; // This will trigger the next iteration of the retry loop
            }

        } catch (error: any) {
            lastError = error;
            const errorMessage = getErrorMessage(error);
            
            // Check for non-retryable quota errors first
            if (errorMessage.includes('quota') || errorMessage.includes('429')) {
                 throw new QuotaError("API quota limit reached.");
            }
            
            // Check for retryable server/network errors
            const isRetryable = errorMessage.includes('503') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded');

            if (!isRetryable) {
                console.error(`Non-retryable error encountered:`, error);
                throw error; // Rethrow immediately
            }

            console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed with a transient error.`, error);
        }
    }
    
    // If loop completes, all retries failed.
    console.error(`Exhausted all retries. Last error:`, lastError);
    const finalErrorMessage = getErrorMessage(lastError);
    if(finalErrorMessage.includes('overloaded') || finalErrorMessage.includes('503')) {
        throw new Error(`The AI model is currently overloaded. We tried for over two minutes without success. Please try again later.`);
    }
    throw new Error(`The AI model is returning invalid data or is unreachable. We tried several times without success. Please try again later.`);
};

const createOutlinePrompt = (
    metadata: VideoMetadata,
    outputDurationMinutes?: number,
    variationPrompt?: string
): string => {
    const isSummaryMode = outputDurationMinutes && outputDurationMinutes > 0;
    const isVariationMode = variationPrompt && variationPrompt.trim().length > 0;
    
    let taskDescription = '';
    if (isVariationMode) {
        taskDescription = `Your task is to act as a showrunner and create a high-level story outline for a NEW story with a total duration of ${metadata.durationFormatted}. This new story is inspired by the user's prompt: "${variationPrompt}". The characters can be from the original video.`;
    } else if (isSummaryMode) {
        taskDescription = `Your task is to act as an editor and create a high-level outline for a compelling summary/trailer of the original video. The final video's duration should be ${outputDurationMinutes} minutes. You need to identify the key moments from the original video to include in this summary.`;
    } else {
        taskDescription = `Your task is to act as a film analyst and create a high-level structural outline of the provided video's narrative. This will be used to generate a detailed screenplay.`;
    }

    return `
    VIDEO METADATA:
    - Title: ${metadata.title}
    - Duration: ${metadata.durationFormatted}
    
    TASK:
    ${taskDescription}
    
    INSTRUCTIONS:
    - Break down the entire story into 3-5 logical parts (e.g., Act 1, Act 2, Act 3 or Beginning, Middle, End).
    - For each part, provide a title, a summary of its key events, and the start/end timestamps.
    - The timestamps for all parts combined must cover the full duration of the video (${metadata.durationFormatted}).
    - The output must be a valid JSON object matching the provided schema.
    `;
};


// AI prompt generation
const createAnalysisPrompt = (
    metadata: VideoMetadata, 
    style: string, 
    sceneCountForChunk: number, 
    chunkInfo: { current: number; total: number; startTimeSecs: number; endTimeSecs: number; },
    storyOutline: StoryOutline,
    outputDurationMinutes?: number, 
    variationPrompt?: string
): string => {
    const isSummaryMode = outputDurationMinutes && outputDurationMinutes > 0;
    const isVariationMode = variationPrompt && variationPrompt.trim().length > 0;

    const { current, total, startTimeSecs, endTimeSecs } = chunkInfo;
    const startTimeFormatted = formatTime(startTimeSecs);
    const endTimeFormatted = formatTime(endTimeSecs);


    let taskDescription = '';
    let scenesGuideline = '';
    let sceneCountGuideline = `        - Generate approximately ${sceneCountForChunk} logical scenes for this chunk's time range.`;
    let timestampsGuideline = `- 't0' and 't1' are timestamps in "mm:ss" format, chronologically ordered and MUST be within this chunk's time range of ${startTimeFormatted} to ${endTimeFormatted}.`;

    // Find the relevant part of the story outline for this chunk
    const relevantOutlinePart = storyOutline.parts.find(part => {
        const partStart = (part.start_time.split(':').map(Number).reduce((acc, time) => acc * 60 + time));
        const partEnd = (part.end_time.split(':').map(Number).reduce((acc, time) => acc * 60 + time));
        return startTimeSecs < partEnd && endTimeSecs > partStart;
    });
    
    const outlineContext = relevantOutlinePart 
        ? `
    HIGH-LEVEL CONTEXT FOR THIS CHUNK:
    You are working on the part of the story titled "${relevantOutlinePart.title}".
    Summary of this part: "${relevantOutlinePart.summary}".
    Your generated scenes must align with this context.
    `
        : '';


    if (isVariationMode) {
        taskDescription = `
    TASK:
    You are a creative screenwriter writing a new story. You are generating detailed scenes for CHUNK ${current} of ${total} (${startTimeFormatted} to ${endTimeFormatted}).
    The overall story is based on the user prompt: "${variationPrompt}"`;

        scenesGuideline = `        - **CRITICAL**: The generated scenes MUST follow the high-level story outline provided in the context section.`;

    } else if (isSummaryMode) {
        taskDescription = `
    TASK:
    You are an editor creating a script for a short summary video. You are selecting highlight scenes for CHUNK ${current} of ${total}.
    The scenes you select must be from the ORIGINAL video's time range ${startTimeFormatted} to ${endTimeFormatted}.
    The target duration for the final summary video is ${outputDurationMinutes} minutes.`;

        scenesGuideline = `        - **CRITICAL**: The scenes must be key highlights that fit into the overall summary outline provided.`;
        
    } else { // Standard analysis
        taskDescription = `
    TASK:
    You are a film analyst generating a detailed screenplay. You are analyzing CHUNK ${current} of ${total} of the video, which covers the time range ${startTimeFormatted} to ${endTimeFormatted}.`;

        scenesGuideline = `        - **CRITICAL**: The scenes must accurately reflect the content of the video within this time range and align with the provided story outline.`;
    }

    return `
    ANALYZE VIDEO (Metadata Only):
    - URL: https://www.youtube.com/watch?v=${metadata.videoId}
    - Title: ${metadata.title}
    
    ${taskDescription}
    ${outlineContext}
    
    OUTPUT STYLE: ${style}
    
    JSON SCHEMA GUIDELINES (enforced by API):
    The output will be a JSON object with 'video_meta', 'scenes', and 'assets'.
    
    CONTENT GUIDELINES:
    1.  **CONTENT POLICY**: All generated content, including scene summaries, descriptions, and assets, must be family-friendly and strictly adhere to a safe-for-work policy. Avoid any descriptions of violence, explicit content, hate speech, or any other sensitive topics. The goal is to create content suitable for a general audience.
    2.  **EVASIVE & SAFE LANGUAGE**: When describing scenes that might contain sensitive elements (like violence, blood, or conflict), use creative and evasive language to mitigate policy risks. For example, instead of 'blood', describe it as 'black liquid' or 'blue liquid'. Instead of a direct depiction of a fight, describe it as 'an intense confrontation' or 'a flurry of quick movements'. The goal is to convey the original intent while ensuring the output is abstract enough to pass content moderation filters.
    3.  **video_meta**: Fill this section briefly. The main 'title' should be from the overall outline.
    4.  **scenes**:
${scenesGuideline}
${timestampsGuideline}
        - **THEMATIC CONSISTENCY**: Ensure all details within a scene (CAM, SUBJ, SET, MOOD, CLR, etc.) are thematically consistent with the scene's 'summary'.
        - **ENHANCED AUDIO**: The 'SND' field must include both ambient sound effects AND a suggestion for background music that fits the mood.
${sceneCountGuideline}
        - 'scene_id' can be numbered starting from 1 for this chunk; it will be re-numbered later.
        - 'style_video': This field MUST be a string that exactly matches the requested OUTPUT STYLE: "${style}".
    5.  **assets**: Identify 3-5 key assets (characters, locations, props) that are relevant FOR THIS CHUNK.
    `;
};

const sanitizeJsonString = (rawString: string): string => {
    const trimmed = rawString.trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (match && match[1]) {
        return match[1];
    }
    return trimmed;
};


export const runAnalysis = async (
    url: string,
    style: string,
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
            { title: "Lấy Siêu dữ liệu Video", status: StepStatus.PENDING, output: '', error: null },
            { title: "Tải Video (Mô phỏng)", status: StepStatus.PENDING, output: '', error: null },
            { title: "Phát hiện Ranh giới Cảnh", status: StepStatus.PENDING, output: '', error: null },
            { title: "Trích xuất & Hiển thị Keyframe", status: StepStatus.PENDING, output: '', error: null },
            { title: "Tạo Dàn Ý Kịch Bản (AI)", status: StepStatus.PENDING, output: '', error: null },
            { title: "Ghi lại Kịch bản chi tiết (AI)", status: StepStatus.PENDING, output: '', error: null },
            { title: "Tổng hợp Kịch bản JSON", status: StepStatus.PENDING, output: '', error: null },
            { title: "Tạo Prompts cho mỗi Cảnh", status: StepStatus.PENDING, output: '', error: null },
        ],
    };

    const updateAndNotify = (updater: (state: AnalysisState) => AnalysisState) => {
        currentState = updater(currentState);
        onStateUpdate(currentState);
    };
    
    const updateStep = (
        stepIndex: number,
        status: StepStatus,
        output?: string | KeyframeOutput,
        error?: string
    ) => {
        updateAndNotify(prevState => {
            const newSteps = [...prevState.steps];
            newSteps[stepIndex] = {
                ...newSteps[stepIndex],
                status,
                output: output !== undefined ? output : newSteps[stepIndex].output,
                error: error || null,
            };
            
            let currentStep = prevState.currentStep;
            if (status === StepStatus.PROCESSING) {
                currentStep = stepIndex;
            } else if (status === StepStatus.COMPLETE && stepIndex < newSteps.length - 1) {
                currentStep = stepIndex + 1;
                if (newSteps[currentStep]) {
                    newSteps[currentStep].status = StepStatus.PROCESSING;
                }
            } else if (status === StepStatus.ERROR) {
                 currentStep = stepIndex;
            }

            return { ...prevState, steps: newSteps, currentStep: currentStep };
        });
    };

    onStateUpdate(currentState); // Initial state notification
    
    try {
        if (!apiKeys || apiKeys.length === 0) {
            throw new Error("Không có API key nào được cung cấp.");
        }

        let currentKeyIndex = 0;
        let ai = new GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] });

        // Step 0: Get Video Metadata
        updateStep(0, StepStatus.PROCESSING);
        await sleep(500);
        const metadata = await fetchVideoMetadata(url);
        if (!metadata || !metadata.videoId || metadata.title.includes("không hợp lệ")) {
            throw new Error("Không thể lấy siêu dữ liệu video. Vui lòng kiểm tra lại URL hoặc API key của YouTube.");
        }
        const metadataString = JSON.stringify(metadata, null, 2);
        updateStep(0, StepStatus.COMPLETE, metadataString);

        // Step 1: Download Video (Simulated)
        await sleep(1500);
        updateStep(1, StepStatus.COMPLETE, `[Simulation] Video downloaded successfully.\nDuration: ${metadata.durationFormatted}`);
        
        // Step 2: Detect Scene Boundaries
        await sleep(2000);
        let totalSceneCount: number;
        let sceneDetectionMessage: string;
        const avgSceneDuration = 8;
        if (variationPrompt) {
            totalSceneCount = Math.max(1, Math.ceil(metadata.duration / avgSceneDuration));
            sceneDetectionMessage = `[Creative Mode] Generating a new story with ~${totalSceneCount} scenes based on original video duration.`;
        } else if (outputDurationMinutes && outputDurationMinutes > 0) {
            totalSceneCount = Math.ceil((outputDurationMinutes * 60) / avgSceneDuration);
            sceneDetectionMessage = `[Summary Mode] To create a ${outputDurationMinutes}-minute summary, ~${totalSceneCount} scenes will be generated.`;
        } else {
            totalSceneCount = Math.max(1, Math.ceil(metadata.duration / avgSceneDuration));
            sceneDetectionMessage = `[Standard Mode] Detected approximately ${totalSceneCount} scenes based on video duration.`;
        }
        updateStep(2, StepStatus.COMPLETE, sceneDetectionMessage);
        
        // Step 3: Extract Keyframes (Simulated)
        await sleep(1500);
        const keyframes: KeyframeOutput = {
            log: `[Simulation] Extracted keyframes for ${totalSceneCount} potential scenes.`,
            keyframes: Array.from({ length: totalSceneCount }, (_, i) => ({
                sceneId: i + 1,
                url: `https://picsum.photos/seed/${metadata.videoId}${i}/160/90`,
            })),
        };
        updateStep(3, StepStatus.COMPLETE, keyframes);

        // Step 4: Generate High-Level Story Outline (AI)
        const MAX_RETRIES = 7; // Increased for more resilience
        const outlinePrompt = createOutlinePrompt(metadata, outputDurationMinutes, variationPrompt);
        const onOutlineRetry = (attempt: number, delay: number, reason: string) => {
            const friendlyReason = reason.includes('json') ? 'Invalid response' : 'Model is overloaded';
            updateStep(4, StepStatus.PROCESSING, `AI Outline: ${friendlyReason}. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${MAX_RETRIES})`);
        };
        const storyOutline: StoryOutline = await generateAndParseJsonWithRetry<StoryOutline>(ai, outlinePrompt, storyOutlineSchema, MAX_RETRIES, onOutlineRetry);
        updateStep(4, StepStatus.COMPLETE, JSON.stringify(storyOutline, null, 2));


        // Step 5: Generate Detailed Script (AI) in Chunks
        const CHUNK_DURATION_SECONDS = 300; // 5 minutes
        const numChunks = Math.ceil(metadata.duration / CHUNK_DURATION_SECONDS);
        let finalJson: GeminiAnalysisResponse | null = null;
        const allAssets = new Map<string, GeminiAsset>();

        for (let i = 0; i < numChunks; i++) {
            const startTimeSecs = i * CHUNK_DURATION_SECONDS;
            const endTimeSecs = Math.min((i + 1) * CHUNK_DURATION_SECONDS, metadata.duration);
            const chunkDuration = endTimeSecs - startTimeSecs;

            if (chunkDuration <= 0) continue;

            let sceneCountForChunk: number;
             if (outputDurationMinutes && outputDurationMinutes > 0) {
                sceneCountForChunk = Math.ceil((chunkDuration / metadata.duration) * totalSceneCount);
            } else {
                sceneCountForChunk = Math.max(1, Math.ceil(chunkDuration / avgSceneDuration));
            }

            const chunkInfo = { current: i + 1, total: numChunks, startTimeSecs, endTimeSecs };
            const prompt = createAnalysisPrompt(metadata, style, sceneCountForChunk, chunkInfo, storyOutline, outputDurationMinutes, variationPrompt);
            
            let parsedChunkJson: GeminiAnalysisResponse | null = null;
            let chunkCompleted = false;

            while (!chunkCompleted) {
                updateStep(5, StepStatus.PROCESSING, `AI Script: Processing chunk ${chunkInfo.current}/${chunkInfo.total} (${formatTime(startTimeSecs)} - ${formatTime(endTimeSecs)})...`);
                
                const onRetry = (attempt: number, delay: number, reason: string) => {
                    const friendlyReason = reason.includes('json') ? 'Invalid response' : 'Model is overloaded';
                    const message = `AI Script: ${friendlyReason}. Retrying chunk ${chunkInfo.current}/${chunkInfo.total} in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${MAX_RETRIES})`;
                    updateStep(5, StepStatus.PROCESSING, message);
                };

                try {
                    parsedChunkJson = await generateAndParseJsonWithRetry<GeminiAnalysisResponse>(ai, prompt, responseSchema, MAX_RETRIES, onRetry);
                    chunkCompleted = true; // Success, exit while loop
                } catch (error) {
                    if (error instanceof QuotaError) {
                        currentKeyIndex++; // Move to the next key

                        if (currentKeyIndex < apiKeys.length) {
                             updateStep(5, StepStatus.PROCESSING, `AI Script: Hạn mức key #${currentKeyIndex} đã hết. Chuyển sang key #${currentKeyIndex + 1}...`);
                             await sleep(1000);
                             ai = new GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] });
                             continue; // Retry the while loop with the new 'ai' instance
                        } else {
                            // All initial keys exhausted, ask for a new one
                            updateStep(5, StepStatus.PROCESSING, `AI Script: Tất cả các key đã hết hạn mức. Đang chờ API key mới...`);
                            const newApiKey = await onAllKeysExhausted();
                            
                            if (!newApiKey) { // User cancelled
                                throw new QuotaError('USER_CANCELLED');
                            }
                            
                            // Add new key to our list and use it
                            apiKeys.push(newApiKey); 
                            ai = new GoogleGenAI({ apiKey: newApiKey }); // Re-initialize with new key
                            continue; // Retry the while loop with the new 'ai' instance
                        }
                    }
                    throw error; // Re-throw other non-quota errors
                }
            }

            if (!parsedChunkJson) continue;

            if (!finalJson) {
                finalJson = parsedChunkJson;
                 if (storyOutline.title) {
                    finalJson.video_meta.title = storyOutline.title; // Use title from outline
                }
            } else {
                finalJson.scenes.push(...parsedChunkJson.scenes);
            }

            if (parsedChunkJson.assets) {
                for (const asset of parsedChunkJson.assets) {
                    if (asset.id && !allAssets.has(asset.id)) {
                        allAssets.set(asset.id, asset);
                    }
                }
            }
        }

        if (!finalJson) {
            throw new Error("AI analysis did not produce any results after processing all chunks.");
        }

        finalJson.assets = Array.from(allAssets.values());
        finalJson.scenes.sort((a, b) => {
            const timeToSeconds = (time: string) => {
                const parts = time.split(':').map(Number);
                return (parts[0] || 0) * 60 + (parts[1] || 0);
            };
            return timeToSeconds(a.t0) - timeToSeconds(b.t0);
        });
        finalJson.scenes.forEach((scene, index) => {
            scene.scene_id = index + 1;
        });

        finalJson.story_outline = storyOutline;
        
        updateStep(5, StepStatus.COMPLETE, `Generated a total of ${finalJson.scenes.length} scenes across ${numChunks} chunks.`);
        
        // Step 6: Compose Final JSON
        await sleep(500);
        updateStep(6, StepStatus.COMPLETE, `Final JSON with ${finalJson.scenes.length} scenes is valid.`);
        
        // Step 7: Generate Scene Prompts (Final Step)
        await sleep(250);
        updateStep(7, StepStatus.COMPLETE, 'Prompts are ready for download.');

        onComplete(finalJson);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        console.error("Analysis failed:", error);
        
        const currentStepIndex = currentState.steps.findIndex(s => s.status === StepStatus.PROCESSING);
        if (currentStepIndex !== -1) {
            updateStep(currentStepIndex, StepStatus.ERROR, undefined, errorMessage);
        } else {
            // If error happens before processing starts, mark the first step
            updateStep(0, StepStatus.ERROR, undefined, errorMessage);
        }
    }
};