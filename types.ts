
export enum StepStatus {
    PENDING,
    PROCESSING,
    COMPLETE,
    ERROR,
}

export interface SubStep {
    title: string;
    status: 'pending' | 'complete';
}

export interface KeyframeData {
    sceneId: number;
    url: string;
}

export interface KeyframeOutput {
    log: string;
    keyframes: KeyframeData[];
}

export interface AnalysisStep {
    title: string;
    status: StepStatus;
    output: string | KeyframeOutput;
    error: string | null;
    subSteps?: SubStep[];
}

export interface AnalysisState {
    currentStep: number;
    steps: AnalysisStep[];
}

export enum JobStatus {
    ANALYZING,
    COMPLETE,
    ERROR,
}

export interface Keyframe {
    ts: number;
    url: string;
    labels: string[];
}

export interface Scene {
    start: number;
    end: number;
    description: string;
}

export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
}

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

export interface VideoMetadata {
    videoId: string;
    title: string;
    author_name: string;
    thumbnail_url: string;
    hasCaptions: boolean;
    duration: number; // Duration in seconds
    durationFormatted: string; // Duration in hh:mm:ss format
}

// Type for the high-level story outline
export interface StoryPart {
    part_id: number;
    title: string;
    summary: string;
    start_time: string; // "mm:ss"
    end_time: string;   // "mm:ss"
}
export interface StoryOutline {
    title: string;
    logline: string;
    parts: StoryPart[];
}


// Types for Gemini AI Analysis Response
export interface GeminiScene {
  scene_id: number;
  t0: string; // "mm:ss"
  t1: string; // "mm:ss"
  summary: string;
  CAM: string;
  SUBJ: string;
  SET: string;
  MOOD: string;
  FX: string;
  CLR: string;
  SND: string;
  EDIT: string;
  RNDR: string;
  '!FOCAL': string;
  TIM: string;
  title: string; 
  style_video: string; // Added style for video generation prompts
}

export interface GeminiAsset {
    id: string;
    type: 'character' | 'location' | 'prop';
    description: string;
}

export interface GeminiAnalysisResponse {
  video_meta: {
    url: string;
    title: string;
    duration_sec: number;
    style: { mood: string; palette: string[]; music: string; };
  };
  scenes: GeminiScene[];
  assets: GeminiAsset[];
  story_outline?: StoryOutline;
}

export interface LibraryEntry {
    id: string; // youtube video id
    url: string;
    title: string;
    thumbnail_url: string;
    createdAt: number; // Timestamp for sorting
    completedAt?: number; // Timestamp for completion
    result?: GeminiAnalysisResponse;
    status: 'pending' | 'processing' | 'complete' | 'error';
    error?: string;
    modelId?: string; // Model used for analysis
}
