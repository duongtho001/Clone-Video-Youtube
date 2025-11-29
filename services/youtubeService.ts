import type { VideoMetadata } from '../types';

// Hardcoded API key for YouTube Data API v3
const YOUTUBE_API_KEY = 'AIzaSyDwTSvkH1mvEuXwjbnE8OqpBlI3SMZTbDk';

const getVideoId = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        // Handles https://www.youtube.com/watch?v=...
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('music.youtube.com')) {
            const videoId = urlObj.searchParams.get('v');
            if (videoId) return videoId;
            // Handles https://www.youtube.com/shorts/...
            if (urlObj.pathname.includes('/shorts/')) {
                return urlObj.pathname.split('/').filter(Boolean).pop() || null;
            }
        }
        // Handles https://youtu.be/...
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.split('/').filter(Boolean).pop() || null;
        }
        return null;
    } catch (e) {
        // Fallback for URLs that are not full URLs but might contain the ID pattern
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        if (match) {
            return match[1];
        }
        console.error("Could not parse video URL", e);
        return null;
    }
};

const parseISO8601Duration = (duration: string): { seconds: number, formatted: string } => {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    if (!matches) return { seconds: 0, formatted: '00:00' };

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    
    const fmtHours = String(hours).padStart(2, '0');
    const fmtMinutes = String(minutes).padStart(2, '0');
    const fmtSeconds = String(seconds).padStart(2, '0');

    let formatted = `${fmtMinutes}:${fmtSeconds}`;
    if (hours > 0) {
        formatted = `${fmtHours}:${formatted}`;
    }

    return { seconds: totalSeconds, formatted };
};


export const fetchVideoMetadata = async (videoUrl: string): Promise<VideoMetadata> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        console.error("Could not extract video ID from URL:", videoUrl);
        return {
            videoId: '',
            title: "URL YouTube không hợp lệ",
            author_name: "Không rõ",
            thumbnail_url: 'https://placehold.co/480x360/1e293b/94a3b8/png?text=URL+không+hợp+lệ',
            hasCaptions: false,
            duration: 0,
            durationFormatted: '00:00',
        };
    }
    
    if (!YOUTUBE_API_KEY) {
        throw new Error("API key của YouTube Data API v3 chưa được cấu hình trong mã nguồn.");
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Yêu cầu API YouTube thất bại với mã ${response.status}: ${errorData?.error?.message || 'Lỗi không xác định'}`);
        }
        const data = await response.json();
        
        const videoItem = data.items?.[0];
        if (!videoItem) {
            throw new Error("Không tìm thấy video hoặc phản hồi không hợp lệ từ API YouTube");
        }
        
        const snippet = videoItem.snippet;
        const contentDetails = videoItem.contentDetails;
        const bestThumbnail = snippet.thumbnails.maxres || snippet.thumbnails.standard || snippet.thumbnails.high || snippet.thumbnails.medium || snippet.thumbnails.default;
        const durationInfo = parseISO8601Duration(contentDetails.duration);

        return {
            videoId: videoId,
            title: snippet.title,
            author_name: snippet.channelTitle,
            thumbnail_url: bestThumbnail.url,
            hasCaptions: contentDetails.caption === 'true',
            duration: durationInfo.seconds,
            durationFormatted: durationInfo.formatted,
        };
    } catch (error) {
        console.error("Error fetching YouTube metadata via Data API:", error);
        
        return {
            videoId: videoId,
            title: "Tiêu đề Video (Không thể lấy)",
            author_name: "Người tải lên (Không thể lấy)",
            thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            hasCaptions: false,
            duration: 0,
            durationFormatted: 'N/A',
        };
    }
};