import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4 transform transition-all scale-100">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 text-red-600">
                <div className="bg-red-100 p-2 rounded-full">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        
        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
            {message}
        </p>

        <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 py-2 px-4 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
                キャンセル
            </button>
            <button onClick={onConfirm} className="flex-1 py-2 px-4 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 shadow-md transition">
                削除する
            </button>
        </div>
      </div>
    </div>
  );
};