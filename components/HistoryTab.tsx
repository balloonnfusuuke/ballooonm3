import React, { useState, useEffect } from 'react';
import { PlateAppearance, GameBatchRecord, PitcherGameRecord } from '../types';
import { getPARecords, deletePARecord, getBatchRecords, deleteBatchRecord, getPitcherRecords, deletePitcherRecord } from '../services/dataService';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export const HistoryTab: React.FC = () => {
    const [liveRecords, setLiveRecords] = useState<PlateAppearance[]>([]);
    const [batchRecords, setBatchRecords] = useState<GameBatchRecord[]>([]);
    const [pitcherRecords, setPitcherRecords] = useState<PitcherGameRecord[]>([]);
    
    const [viewMode, setViewMode] = useState<'live'|'batch'|'pitcher'>('live');

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{type: 'live'|'batch'|'pitcher', id: string} | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setLiveRecords(getPARecords());
        setBatchRecords(getBatchRecords());
        setPitcherRecords(getPitcherRecords());
    };
    
    const handleDeleteClick = (type: 'live'|'batch'|'pitcher', id: string) => {
        setDeleteTarget({ type, id });
    };

    const executeDelete = () => {
        if (!deleteTarget) return;

        if (deleteTarget.type === 'live') {
            deletePARecord(deleteTarget.id);
            setLiveRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        } else if (deleteTarget.type === 'batch') {
            deleteBatchRecord(deleteTarget.id);
            setBatchRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        } else if (deleteTarget.type === 'pitcher') {
            deletePitcherRecord(deleteTarget.id);
            setPitcherRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        }
        setDeleteTarget(null);
    };

    return (
        <div className="pb-20 max-w-4xl mx-auto space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-bold text-team-navy">登録データ管理</h2>
            
            <div className="flex gap-2">
               <button onClick={()=>setViewMode('live')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='live'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>野手速報 ({liveRecords.length})</button>
               <button onClick={()=>setViewMode('batch')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='batch'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>野手一括 ({batchRecords.length})</button>
               <button onClick={()=>setViewMode('pitcher')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='pitcher'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>投手 ({pitcherRecords.length})</button>
            </div>

            <div className="space-y-2">
                {viewMode === 'live' && (liveRecords.length === 0 ? <p className="text-slate-400 p-4">データがありません</p> : liveRecords.slice().reverse().map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="text-sm">
                            <span className="font-bold mr-2 text-slate-500">{r.date}</span>
                            <span className="font-bold text-team-navy mr-2">{r.playerName}</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{r.result}</span>
                            <span className="ml-2 text-slate-400 text-xs">{r.inning}回 vs {r.opponent}</span>
                        </div>
                        <button onClick={() => handleDeleteClick('live', r.id)}><Trash2 size={18} className="text-slate-300 hover:text-red-500"/></button>
                    </div>
                )))}
                {viewMode === 'batch' && (batchRecords.length === 0 ? <p className="text-slate-400 p-4">データがありません</p> : batchRecords.slice().reverse().map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="text-sm">
                            <span className="font-bold mr-2 text-slate-500">{r.date}</span>
                            <span className="font-bold text-team-navy mr-2">{r.playerName}</span>
                            <span className="text-slate-600">{r.ab}打数 {r.h}安打 {r.hr}本</span>
                        </div>
                        <button onClick={() => handleDeleteClick('batch', r.id)}><Trash2 size={18} className="text-slate-300 hover:text-red-500"/></button>
                    </div>
                )))}
                {viewMode === 'pitcher' && (pitcherRecords.length === 0 ? <p className="text-slate-400 p-4">データがありません</p> : pitcherRecords.slice().reverse().map(r => (
                     <div key={r.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="text-sm">
                            <span className="font-bold mr-2 text-slate-500">{r.date}</span>
                            <span className="font-bold text-team-navy mr-2">{r.playerName}</span>
                            <span className="bg-red-50 text-red-800 px-2 py-0.5 rounded text-xs font-bold mr-2">{Math.floor(r.outs/3)}.{r.outs%3}回</span>
                            <span className="text-slate-600">自責{r.er} 奪三振{r.k}</span>
                        </div>
                        <button onClick={() => handleDeleteClick('pitcher', r.id)}><Trash2 size={18} className="text-slate-300 hover:text-red-500"/></button>
                    </div>
                )))}
            </div>

            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title="データの削除"
                message="この記録を削除してもよろしいですか？この操作は取り消せません。"
                onConfirm={executeDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
};