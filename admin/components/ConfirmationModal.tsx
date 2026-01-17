"use client";

import React from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

export type ConfirmationModalColor = "green" | "red" | "blue" | "amber" | "purple";

export interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  confirmColor?: ConfirmationModalColor;
  isProcessing?: boolean;
  processingText?: string;
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  details = [],
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "blue",
  isProcessing = false,
  processingText = "Processing...",
}: ConfirmationModalProps) {
  if (!open) return null;

  const getColorClasses = (color: ConfirmationModalColor) => {
    switch (color) {
      case "green":
        return {
          header: "bg-green-500/20 border-green-500/30",
          iconBg: "bg-green-500/20",
          title: "text-green-400",
          detailsBg: "bg-green-500/10 border-green-500/20",
          detailsText: "text-green-200",
          button: "bg-green-600 hover:bg-green-700 border-green-500",
        };
      case "red":
        return {
          header: "bg-red-500/20 border-red-500/30",
          iconBg: "bg-red-500/20",
          title: "text-red-400",
          detailsBg: "bg-red-500/10 border-red-500/20",
          detailsText: "text-red-200",
          button: "bg-red-600 hover:bg-red-700 border-red-500",
        };
      case "amber":
        return {
          header: "bg-amber-500/20 border-amber-500/30",
          iconBg: "bg-amber-500/20",
          title: "text-amber-400",
          detailsBg: "bg-amber-500/10 border-amber-500/20",
          detailsText: "text-amber-200",
          button: "bg-amber-600 hover:bg-amber-700 border-amber-500",
        };
      case "purple":
        return {
          header: "bg-purple-500/20 border-purple-500/30",
          iconBg: "bg-purple-500/20",
          title: "text-purple-400",
          detailsBg: "bg-purple-500/10 border-purple-500/20",
          detailsText: "text-purple-200",
          button: "bg-purple-600 hover:bg-purple-700 border-purple-500",
        };
      case "blue":
      default:
        return {
          header: "bg-blue-500/20 border-blue-500/30",
          iconBg: "bg-blue-500/20",
          title: "text-blue-400",
          detailsBg: "bg-blue-500/10 border-blue-500/20",
          detailsText: "text-blue-200",
          button: "bg-blue-600 hover:bg-blue-700 border-blue-500",
        };
    }
  };

  const getIcon = (color: ConfirmationModalColor) => {
    switch (color) {
      case "green":
        return <CheckCircleIcon className="h-6 w-6 text-green-400" />;
      case "red":
        return <XCircleIcon className="h-6 w-6 text-red-400" />;
      case "amber":
        return <ExclamationTriangleIcon className="h-6 w-6 text-amber-400" />;
      case "purple":
        return <InformationCircleIcon className="h-6 w-6 text-purple-400" />;
      case "blue":
      default:
        return <InformationCircleIcon className="h-6 w-6 text-blue-400" />;
    }
  };

  const getButtonIcon = (color: ConfirmationModalColor) => {
    switch (color) {
      case "green":
        return <CheckCircleIcon className="h-4 w-4 mr-1.5" />;
      case "red":
        return <XCircleIcon className="h-4 w-4 mr-1.5" />;
      case "amber":
        return <ExclamationTriangleIcon className="h-4 w-4 mr-1.5" />;
      case "purple":
        return <CheckCircleIcon className="h-4 w-4 mr-1.5" />;
      case "blue":
      default:
        return <CheckCircleIcon className="h-4 w-4 mr-1.5" />;
    }
  };

  const colors = getColorClasses(confirmColor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
      />
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`border-b px-6 py-4 ${colors.header}`}>
          <div className="flex items-center">
            <div className={`flex-shrink-0 rounded-full p-2 ${colors.iconBg}`}>
              {getIcon(confirmColor)}
            </div>
            <h3 className={`ml-3 text-lg font-semibold ${colors.title}`}>
              {title}
            </h3>
          </div>
        </div>
        {/* Content */}
        <div className="px-6 py-5">
          <div className="space-y-4">
            <p className="text-gray-300">{message}</p>
            {details.length > 0 && (
              <div className={`border rounded-lg p-4 ${colors.detailsBg}`}>
                <ul className={`text-sm space-y-1.5 ${colors.detailsText}`}>
                  {details.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="bg-gray-800/50 border-t border-gray-700/50 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 text-sm font-medium text-white border rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                {processingText}
              </>
            ) : (
              <>
                {getButtonIcon(confirmColor)}
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
