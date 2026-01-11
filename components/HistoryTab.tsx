
import React, { useState, useEffect } from 'react';
import { PlateAppearance, GameBatchRecord, PitcherGameRecord, PitcherPlayRecord } from '../types';
import { getPARecords, deletePARecord, updatePARecord, getBatchRecords, deleteBatchRecord, updateBatchRecord, getPitcherRecords, deletePitcherRecord, updatePitcherRecord, getPitcherPlayRecords, deletePitcherPlayRecord, updatePitcherPlayRecord } from '../services/dataService';
import { Trash2, Edit2, X, Save } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export const HistoryTab: React.FC = () => {
    const [liveRecords, setLiveRecords] = useState<PlateAppearance[]>([]);
    const [batchRecords, setBatchRecords] = useState<GameBatchRecord[]>([]);
    const [pitcherRecords, setPitcherRecords] = useState<PitcherGameRecord[]>([]);
    const [pitcherPlayRecords, setPitcherPlayRecords] = useState<PitcherPlayRecord[]>([]);
    
    const [viewMode, setViewMode] = useState<'live'|'batch'|'pitcher_batch'|'pitcher_live'>('live');

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{type: 'live'|'batch'|'pitcher_batch'|'pitcher_live', id: string} | null>(null);

    // Edit State
    const [editTarget, setEditTarget] = useState<{type: 'live'|'batch'|'pitcher_batch'|'pitcher_live', record: any} | null>(null);
    const [editForm, setEditForm] = useState<any>(null); // Holds the form data

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setLiveRecords(getPARecords());
        setBatchRecords(getBatchRecords());
        setPitcherRecords(getPitcherRecords());
        setPitcherPlayRecords(getPitcherPlayRecords());
    };
    
    const handleDeleteClick = (type: 'live'|'batch'|'pitcher_batch'|'pitcher_live', id: string) => {
        setDeleteTarget({ type, id });
    };

    const handleEditClick = (type: 'live'|'batch'|'pitcher_batch'|'pitcher_live', record: any) => {
        setEditTarget({ type, record });
        
        // Prepare initial form state
        if (type === 'pitcher_batch') {
            const pRec = record as PitcherGameRecord;
            const ipDisplay = `${Math.floor(pRec.outs / 3)}${pRec.outs % 3 > 0 ? '.' + (pRec.outs % 3) : ''}`;
            setEditForm({ ...pRec, ipDisplay });
        } else {
            setEditForm({ ...record });
        }
    };

    const handleEditChange = (key: string, value: any) => {
        setEditForm((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSaveEdit = () => {
        if (!editTarget || !editForm) return;

        if (editTarget.type === 'live') {
            const updated = editForm as PlateAppearance;
            updatePARecord(updated);
        } else if (editTarget.type === 'batch') {
            const updated = editForm as GameBatchRecord;
            updateBatchRecord(updated);
        } else if (editTarget.type === 'pitcher_live') {
            const updated = editForm as PitcherPlayRecord;
            updatePitcherPlayRecord(updated);
        } else if (editTarget.type === 'pitcher_batch') {
            // Convert IP string back to outs
            const ipStr = String(editForm.ipDisplay || "0");
            const parts = ipStr.split('.');
            const main = parseInt(parts[0]) || 0;
            const frac = parseInt(parts[1]) || 0;
            const outs = (main * 3) + (frac > 2 ? 2 : frac); // clamp frac 0-2
            
            const updated: PitcherGameRecord = {
                ...editForm,
                outs: outs
            };
            delete (updated as any).ipDisplay;
            updatePitcherRecord(updated);
        }

        setEditTarget(null);
        setEditForm(null);
        loadData();
    };

    const executeDelete = () => {
        if (!deleteTarget) return;

        if (deleteTarget.type === 'live') {
            deletePARecord(deleteTarget.id);
            setLiveRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        } else if (deleteTarget.type === 'batch') {
            deleteBatchRecord(deleteTarget.id);
            setBatchRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        } else if (deleteTarget.type === 'pitcher_batch') {
            deletePitcherRecord(deleteTarget.id);
            setPitcherRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        } else if (deleteTarget.type === 'pitcher_live') {
            deletePitcherPlayRecord(deleteTarget.id);
            setPitcherPlayRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        }
        setDeleteTarget(null);
    };

    return (
        <div className="pb-20 max-w-4xl mx-auto space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-bold text-team-navy">登録データ管理</h2>
            
            <div className="flex gap-2 flex-wrap">
               <button onClick={()=>setViewMode('live')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='live'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>野手速報 ({liveRecords.length})</button>
               <button onClick={()=>setViewMode('batch')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='batch'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>野手一括 ({batchRecords.length})</button>
               <button onClick={()=>setViewMode('pitcher_live')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='pitcher_live'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>投手速報 ({pitcherPlayRecords.length})</button>
               <button onClick={()=>setViewMode('pitcher_batch')} className={`px-4 py-2 rounded font-bold text-sm ${viewMode==='pitcher_batch'?'bg-team-navy text-white':'bg-slate-200 text-slate-500'}`}>投手一括 ({pitcherRecords.length})</button>
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
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick('live', r)} className="text-slate-300 hover:text-blue-600"><Edit2 size={18}/></button>
                            <button onClick={() => handleDeleteClick('live', r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                    </div>
                )))}
                
                {viewMode === 'batch' && (batchRecords.length === 0 ? <p className="text-slate-400 p-4">データがありません</p> : batchRecords.slice().reverse().map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="text-sm">
                            <span className="font-bold mr-2 text-slate-500">{r.date}</span>
                            <span className="font-bold text-team-navy mr-2">{r.playerName}</span>
                            <span className="text-slate-600">{r.ab}打数 {r.h}安打 {r.hr}本</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick('batch', r)} className="text-slate-300 hover:text-blue-600"><Edit2 size={18}/></button>
                            <button onClick={() => handleDeleteClick('batch', r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                    </div>
                )))}

                {viewMode === 'pitcher_live' && (pitcherPlayRecords.length === 0 ? <p className="text-slate-400 p-4">データがありません</p> : pitcherPlayRecords.slice().reverse().map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="text-sm">
                            <span className="font-bold mr-2 text-slate-500">{r.date}</span>
                            <span className="font-bold text-team-navy mr-2">{r.playerName}</span>
                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{r.result}</span>
                            <span className="ml-2 text-slate-400 text-xs">{r.inning}回 vs {r.opponent}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick('pitcher_live', r)} className="text-slate-300 hover:text-blue-600"><Edit2 size={18}/></button>
                            <button onClick={() => handleDeleteClick('pitcher_live', r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                    </div>
                )))}

                {viewMode === 'pitcher_batch' && (pitcherRecords.length === 0 ? <p className="text-slate-400 p-4">データがありません</p> : pitcherRecords.slice().reverse().map(r => (
                     <div key={r.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="text-sm">
                            <span className="font-bold mr-2 text-slate-500">{r.date}</span>
                            <span className="font-bold text-team-navy mr-2">{r.playerName}</span>
                            <span className="bg-red-50 text-red-800 px-2 py-0.5 rounded text-xs font-bold mr-2">{Math.floor(r.outs/3)}.{r.outs%3}回</span>
                            <span className="text-slate-600">自責{r.er} 奪三振{r.k}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick('pitcher_batch', r)} className="text-slate-300 hover:text-blue-600"><Edit2 size={18}/></button>
                            <button onClick={() => handleDeleteClick('pitcher_batch', r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                    </div>
                )))}
            </div>

            {/* EDIT MODAL */}
            {editTarget && editForm && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Edit2 size={18}/> 記録の編集</h3>
                            <button onClick={() => setEditTarget(null)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="text-xs text-slate-400 font-bold mb-2">{editForm.date} vs {editForm.opponent} - {editForm.playerName}</div>
                            
                            {/* Live Batter Edit */}
                            {editTarget.type === 'live' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">イニング</label>
                                        <input type="number" className="w-full p-2 border rounded" value={editForm.inning} onChange={(e)=>handleEditChange('inning', parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">結果</label>
                                        <select className="w-full p-2 border rounded" value={editForm.result} onChange={(e)=>handleEditChange('result', e.target.value)}>
                                            {['1B','2B','3B','HR','BB','IBB','HBP','SO','GO','FO','SAC','SF','ROE','FC','GIDP','XI'].map(op => <option key={op} value={op}>{op}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">打点 (RBI)</label>
                                        <input type="number" className="w-full p-2 border rounded" value={editForm.rbi} onChange={(e)=>handleEditChange('rbi', parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex items-center pt-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4" checked={editForm.isSteal} onChange={(e)=>handleEditChange('isSteal', e.target.checked)} />
                                            <span className="text-sm font-bold">盗塁 (SB)</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Batch Batter Edit */}
                            {editTarget.type === 'batch' && (
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">打数</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.ab} onChange={(e)=>handleEditChange('ab', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">安打</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.h} onChange={(e)=>handleEditChange('h', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">二塁打</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.double} onChange={(e)=>handleEditChange('double', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">本塁打</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.hr} onChange={(e)=>handleEditChange('hr', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">打点</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.rbi} onChange={(e)=>handleEditChange('rbi', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">得点</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.r} onChange={(e)=>handleEditChange('r', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">三振</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.k} onChange={(e)=>handleEditChange('k', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">四球</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.bb} onChange={(e)=>handleEditChange('bb', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">盗塁</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.sb} onChange={(e)=>handleEditChange('sb', parseInt(e.target.value))} /></div>
                                </div>
                            )}

                            {/* Live Pitcher Edit */}
                            {editTarget.type === 'pitcher_live' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">イニング</label>
                                        <input type="number" className="w-full p-2 border rounded" value={editForm.inning} onChange={(e)=>handleEditChange('inning', parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">結果</label>
                                        <select className="w-full p-2 border rounded" value={editForm.result} onChange={(e)=>handleEditChange('result', e.target.value)}>
                                            {['1B','2B','3B','HR','BB','IBB','HBP','SO','GO','FO','SAC','SF','GIDP','WP','BK'].map(op => <option key={op} value={op}>{op}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">失点</label>
                                        <input type="number" className="w-full p-2 border rounded" value={editForm.runScored} onChange={(e)=>handleEditChange('runScored', parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">自責点</label>
                                        <input type="number" className="w-full p-2 border rounded" value={editForm.earnedRun} onChange={(e)=>handleEditChange('earnedRun', parseInt(e.target.value))} />
                                    </div>
                                </div>
                            )}

                            {/* Batch Pitcher Edit */}
                            {editTarget.type === 'pitcher_batch' && (
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500">投球回 (例: 3.1)</label><input type="text" className="w-full p-1 border rounded text-center" value={editForm.ipDisplay} onChange={(e)=>handleEditChange('ipDisplay', e.target.value)} /></div>
                                    <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500">結果</label>
                                        <select className="w-full p-1 border rounded" value={editForm.result || ''} onChange={(e)=>handleEditChange('result', e.target.value || null)}>
                                            <option value="">なし</option>
                                            <option value="W">勝利</option>
                                            <option value="L">敗北</option>
                                            <option value="SV">セーブ</option>
                                            <option value="HLD">ホールド</option>
                                        </select>
                                    </div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">被安打</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.h} onChange={(e)=>handleEditChange('h', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">奪三振</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.k} onChange={(e)=>handleEditChange('k', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">四球</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.bb} onChange={(e)=>handleEditChange('bb', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">死球</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.hbp} onChange={(e)=>handleEditChange('hbp', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">失点</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.r} onChange={(e)=>handleEditChange('r', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">自責点</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.er} onChange={(e)=>handleEditChange('er', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1"><label className="text-[10px] font-bold text-slate-500">球数</label><input type="number" className="w-full p-1 border rounded text-center" value={editForm.p_count} onChange={(e)=>handleEditChange('p_count', parseInt(e.target.value))} /></div>
                                    <div className="col-span-1 flex items-end"><label className="flex items-center gap-1"><input type="checkbox" checked={editForm.isStarter} onChange={(e)=>handleEditChange('isStarter', e.target.checked)} /><span className="text-xs font-bold">先発</span></label></div>
                                </div>
                            )}

                        </div>
                        <div className="p-4 border-t flex gap-3 bg-slate-50">
                             <button onClick={() => setEditTarget(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">キャンセル</button>
                             <button onClick={handleSaveEdit} className="flex-1 py-3 bg-team-navy text-white font-bold rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"><Save size={18}/> 保存する</button>
                        </div>
                    </div>
                </div>
            )}

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
