
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { SendIcon } from './icons/SendIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface AiChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isLoading: boolean;
}

const AiChat: React.FC<AiChatProps> = ({ messages, onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <div className="bg-white rounded-lg flex flex-col h-full w-full max-h-[calc(100vh-200px)] lg:max-h-full border border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Hỏi AI về video này</h3>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'ai' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex-shrink-0"></div>
                            )}
                            <div
                                className={`max-w-xs md:max-w-sm lg:max-w-md px-4 py-2 rounded-xl ${
                                    msg.sender === 'user'
                                        ? 'bg-red-600 text-white rounded-br-none'
                                        : 'bg-gray-200 text-gray-800 rounded-bl-none'
                                }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex-shrink-0"></div>
                             <div className="max-w-xs px-4 py-2 rounded-xl bg-gray-200 text-gray-800 rounded-bl-none">
                                <LoadingSpinner className="w-5 h-5" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 border-t border-gray-200">
                <form onSubmit={handleSend} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="ví dụ: Tóm tắt video..."
                        className="flex-grow bg-gray-100 border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-10 h-10 flex items-center justify-center bg-red-600 rounded-full text-white hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                        <SendIcon />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AiChat;