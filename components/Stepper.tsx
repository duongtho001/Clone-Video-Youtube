
import React from 'react';

interface StepperProps {
    currentStep: number;
    steps: string[];
}

export const Stepper: React.FC<StepperProps> = ({ currentStep, steps }) => {
    return (
        <nav aria-label="Progress">
            <ol role="list" className="space-y-4 md:flex md:space-y-0 md:space-x-8">
                {steps.map((step, index) => (
                    <li key={step} className="md:flex-1">
                        {index < currentStep ? (
                            <div className="group flex flex-col border-l-4 border-red-600 py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                                <span className="text-sm font-medium text-red-600">{`Step ${index + 1}`}</span>
                                <span className="text-sm font-medium text-gray-800">{step}</span>
                            </div>
                        ) : index === currentStep ? (
                            <div className="group flex flex-col border-l-4 border-red-600 py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0" aria-current="step">
                                <span className="text-sm font-medium text-red-600">{`Step ${index + 1}`}</span>
                                <span className="text-sm font-medium text-gray-900">{step}</span>
                            </div>
                        ) : (
                             <div className="group flex flex-col border-l-4 border-gray-300 py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                                <span className="text-sm font-medium text-gray-500">{`Step ${index + 1}`}</span>
                                <span className="text-sm font-medium text-gray-500">{step}</span>
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};