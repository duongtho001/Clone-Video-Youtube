import { GoogleGenAI, Chat, Type } from "@google/genai";
import { fetchVideoMetadata } from './youtubeService';

let chat: Chat | null = null;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const startChat = (context: string) => {
    // The chat will be initialized with system instructions.
    chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `Bạn là một trợ lý AI hữu ích. Nhiệm vụ của bạn là trả lời các câu hỏi về một video đã được phân tích. Đây là bản phân tích video ở định dạng JSON:\n\n${context}\n\nDựa vào thông tin này, hãy trả lời câu hỏi của người dùng một cách ngắn gọn và chính xác.`,
        },
    });
};

export const sendChatMessage = async (message: string): Promise<string> => {
    if (!chat) {
        // This is a failsafe. `startChat` should always be called after analysis succeeds.
        throw new Error("Chat not initialized. Call startChat first.");
    }
    try {
        const response = await chat.sendMessage({ message });
        return response.text;
    } catch (error) {
        console.error("Error sending chat message:", error);
        throw new Error("Không thể gửi tin nhắn đến AI. Vui lòng thử lại.");
    }
};


export const generateStoryIdeas = async (videoUrl: string): Promise<string[]> => {
    try {
        const metadata = await fetchVideoMetadata(videoUrl);
        if (!metadata || !metadata.videoId) {
            throw new Error("Không thể lấy siêu dữ liệu video để tạo gợi ý.");
        }

        const prompt = `Dựa trên video có tiêu đề "${metadata.title}", hãy đề xuất 3 ý tưởng ngắn gọn, trong một câu cho một cuộc phiêu lưu hoặc câu chuyện hoàn toàn mới có các nhân vật chính. Chỉ trả về một mảng chuỗi JSON hợp lệ.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING
                    }
                }
            },
        });
        
        const jsonString = response.text;
        const ideas = JSON.parse(jsonString);
        
        if (Array.isArray(ideas) && ideas.every(item => typeof item === 'string')) {
            return ideas;
        } else {
            throw new Error("Phản hồi AI không phải là một mảng chuỗi hợp lệ.");
        }
    } catch (error) {
        console.error("Error generating story ideas:", error);
        throw new Error("Không thể tạo gợi ý từ AI. Vui lòng thử lại.");
    }
};