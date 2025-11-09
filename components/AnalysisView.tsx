import React from 'react';
import {
    AnalysisState,
    VideoMetadata,
    StepStatus,
    GeminiAnalysisResponse
} from '../types';
import VideoHeader from './VideoHeader';
import { Stepper } from './Stepper';
import StepCard from './StepCard';
import JsonOutputCard from './JsonOutputCard';
import Step6Card from './Step6Card';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface AnalysisViewProps {
    analysisState: AnalysisState | null;
    videoMetadata: VideoMetadata | null;
    error: string | null;
    finalResult: GeminiAnalysisResponse | null;
}

const STEP_TITLES = [
    "Lấy Siêu dữ liệu Video",
    "Tải Video (Mô phỏng)",
    "Phát hiện Ranh giới Cảnh",
    "Trích xuất & Hiển thị Keyframe",
    "Tạo Dàn Ý Kịch Bản (AI)",
    "Ghi lại Kịch bản chi tiết (AI)",
    "Tổng hợp Kịch bản JSON",
    "Tạo Prompts cho mỗi Cảnh",
];

const AnalysisView: React.FC<AnalysisViewProps> = ({
    analysisState,
    videoMetadata,
    error,
    finalResult,
}) => {
    
    const renderAnalysisProgress = () => {
        if (!analysisState) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-lg border border-gray-200">
                    <LoadingSpinner className="w-12 h-12" />
                    <p className="mt-4 text-gray-600">Đang khởi tạo trình phân tích...</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {analysisState.steps.map((step, index) => {
                    if (index === 7 && step.status === StepStatus.COMPLETE && finalResult) {
                         return <Step6Card key={index} result={finalResult} />;
                    }
                    if (index === 6 && step.status === StepStatus.COMPLETE && finalResult) {
                        return <JsonOutputCard key={index} result={finalResult} />;
                    }
                    return (
                        <StepCard 
                            key={index} 
                            step={step}
                            isActive={analysisState.currentStep === index} 
                        />
                    );
                })}
            </div>
        );
    };
    
    return (
        <div className="space-y-6">
            {videoMetadata && <VideoHeader metadata={videoMetadata} />}

            {analysisState && 
                <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
                    <Stepper currentStep={analysisState.currentStep} steps={STEP_TITLES} />
                </div>
            }

            {error && (
                 <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <h3 className="text-lg font-semibold text-red-800">Phân tích không thành công</h3>
                    <p className="text-red-700 mt-2">{error}</p>
                </div>
            )}
            
            {renderAnalysisProgress()}
        </div>
    );
};

export default AnalysisView;