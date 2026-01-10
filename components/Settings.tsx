import React, { useState, useEffect } from 'react';
import { Player, Opponent } from '../types';
import { getPlayers, savePlayer, deletePlayer, getOpponents, saveOpponent, deleteOpponent, generateUUID, getAllDataJSON, importDataJSON } from '../services/dataService';
import { User, Trash2, Plus, Users, Shield, Download, Upload, Save, AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export const Settings: React.FC = () => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [opponents, setOpponents] = useState<Opponent[]>([]);

    // Player Form State
    const [pName, setPName] = useState('');
    const [pNumber, setPNumber] = useState('');
    const [pPosition, setPPosition] = useState('');
    const [pType, setPType] = useState<'batter'|'pitcher'|'two-way'>('batter');

    // Opponent Form State
    const [oName, setOName] = useState('');

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{type: 'player'|'opponent', id: string, name: string} | null>(null);

    // Import State
    const [importStatus, setImportStatus] = useState<string>('');
    const [isImportError, setIsImportError] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setPlayers(getPlayers());
        setOpponents(getOpponents());
    };

    const handleAddPlayer = () => {
        if(!pName || !pNumber) return;
        const newPlayer: Player = {
            id: generateUUID(),
            name: pName,
            number: pNumber,
            position: pPosition,
            type: pType
        };
        savePlayer(newPlayer);
        setPName(''); setPNumber(''); setPPosition('');
        loadData();
    };

    const handleDeletePlayerClick = (p: Player) => {
        setDeleteTarget({ type: 'player', id: p.id, name: p.name });
    };

    const handleAddOpponent = () => {
        if(!oName) return;
        const newOpp: Opponent = {
            id: generateUUID(),
            name: oName
        };
        saveOpponent(newOpp);
        setOName('');
        loadData();
    };

    const handleDeleteOpponentClick = (o: Opponent) => {
        setDeleteTarget({ type: 'opponent', id: o.id, name: o.name });
    };

    const executeDelete = () => {
        if (!deleteTarget) return;

        if (deleteTarget.type === 'player') {
            deletePlayer(deleteTarget.id);
        } else {
            deleteOpponent(deleteTarget.id);
        }
        loadData();
        setDeleteTarget(null);
    };

    // Backup & Restore Handlers
    const handleBackup = () => {
        const json = getAllDataJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `indieball_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportStatus('読み込み中...');
        setIsImportError(false);

        const reader = new FileReader();

        reader.onload = (event) => {
            const content = event.target?.result as string;
            const success = importDataJSON(content);
            if (success) {
                setImportStatus('データの復元が完了しました。ページを再読み込みします...');
                setIsImportError(false);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                setImportStatus('エラー: 正しいバックアップファイルではありません。');
                setIsImportError(true);
            }
        };

        reader.onerror = () => {
            setImportStatus('エラー: ファイルの読み込みに失敗しました。もう一度選択してください。');
            setIsImportError(true);
        };

        try {
            reader.readAsText(file);
        } catch (err) {
            setImportStatus('エラー: ファイルにアクセスできませんでした。');
            setIsImportError(true);
        }

        // Reset input value to allow selecting the same file again if needed
        e.target.value = '';
    };

    return (
        <div className="pb-20 max-w-5xl mx-auto space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-team-navy">設定・マスタ管理</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* --- Player Management --- */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700"><Users size={20}/> 選手名鑑登録</h3>
                    
                    {/* Add Form */}
                    <div className="grid grid-cols-12 gap-2 bg-slate-50 p-4 rounded-lg">
                        <div className="col-span-4">
                            <label className="text-xs font-bold text-slate-500">選手名</label>
                            <input type="text" value={pName} onChange={e=>setPName(e.target.value)} placeholder="例: 佐藤 健太" className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-slate-500">背番号</label>
                            <input type="text" value={pNumber} onChange={e=>setPNumber(e.target.value)} placeholder="1" className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div className="col-span-3">
                            <label className="text-xs font-bold text-slate-500">守備</label>
                            <select value={pPosition} onChange={e=>setPPosition(e.target.value)} className="w-full p-2 border rounded text-sm">
                                <option value="">--</option>
                                <option value="P">投手</option>
                                <option value="C">捕手</option>
                                <option value="1B">一塁</option>
                                <option value="2B">二塁</option>
                                <option value="3B">三塁</option>
                                <option value="SS">遊撃</option>
                                <option value="OF">外野</option>
                                <option value="DH">指名</option>
                            </select>
                        </div>
                        <div className="col-span-3">
                             <label className="text-xs font-bold text-slate-500">タイプ</label>
                             <select value={pType} onChange={e=>setPType(e.target.value as any)} className="w-full p-2 border rounded text-sm">
                                <option value="batter">野手</option>
                                <option value="pitcher">投手</option>
                                <option value="two-way">二刀流</option>
                            </select>
                        </div>
                        <div className="col-span-12 mt-2">
                            <button onClick={handleAddPlayer} className="w-full py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 flex items-center justify-center gap-2">
                                <Plus size={16}/> 選手を追加
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold bg-slate-200 w-8 h-8 flex items-center justify-center rounded-full text-slate-600 text-sm">{p.number}</span>
                                    <div>
                                        <div className="font-bold text-sm text-team-navy">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.position} / {p.type==='batter'?'野手':p.type==='pitcher'?'投手':'二刀流'}</div>
                                    </div>
                                </div>
                                <button onClick={()=>handleDeletePlayerClick(p)} className="text-slate-300 hover:text-red-500 p-2">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- Opponent Management --- */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700"><Shield size={20}/> 対戦相手リスト</h3>
                    
                    {/* Add Form */}
                    <div className="flex gap-2 bg-slate-50 p-4 rounded-lg items-end">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500">チーム名</label>
                            <input type="text" value={oName} onChange={e=>setOName(e.target.value)} placeholder="例: 〇〇オーシャンズ" className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <button onClick={handleAddOpponent} className="py-2 px-4 bg-green-600 text-white font-bold rounded shadow hover:bg-green-700 flex items-center gap-2 h-[38px]">
                            <Plus size={16}/> 追加
                        </button>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                         {opponents.map(o => (
                            <div key={o.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition">
                                <span className="font-bold text-sm text-slate-700">{o.name}</span>
                                <button onClick={()=>handleDeleteOpponentClick(o)} className="text-slate-300 hover:text-red-500 p-2">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                         ))}
                         {opponents.length === 0 && <div className="text-sm text-slate-400 text-center py-4">登録なし</div>}
                    </div>
                </div>

                {/* --- System Backup/Restore --- */}
                <div className="bg-slate-800 text-white p-6 rounded-xl border border-slate-700 shadow-sm space-y-4 md:col-span-2">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Save size={20}/> データバックアップ・共有</h3>
                    <p className="text-sm text-slate-300">
                        入力した全データをファイル(.json)として保存・復元できます。<br/>
                        チームメンバーにデータを共有したい場合、ここでファイルを保存し、LINE等で送付してください。<br/>
                        受け取ったメンバーは「データを復元」からファイルを読み込むことで成績を同期できます。
                    </p>
                    
                    <div className="flex flex-col md:flex-row gap-4 pt-2">
                        <button onClick={handleBackup} className="flex-1 py-3 px-4 bg-white text-team-navy font-bold rounded-lg shadow hover:bg-slate-100 flex items-center justify-center gap-2 transition">
                            <Download size={18}/> 全データをファイルに保存
                        </button>
                        
                        <div className="flex-1 relative">
                            <input 
                                type="file" 
                                accept=".json"
                                onChange={handleFileSelect}
                                onClick={(e) => (e.currentTarget.value = '')} // Reset on click to ensure onChange fires even for same file
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="w-full h-full py-3 px-4 bg-slate-700 text-white font-bold rounded-lg border border-slate-600 hover:bg-slate-600 flex items-center justify-center gap-2 transition pointer-events-none">
                                <Upload size={18}/> データを復元 (ファイルを選択)
                            </div>
                        </div>
                    </div>
                    {importStatus && (
                        <div className={`text-center font-bold mt-2 p-2 rounded flex items-center justify-center gap-2 ${isImportError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {isImportError && <AlertTriangle size={16}/>}
                            {importStatus}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title={deleteTarget?.type === 'player' ? "選手の削除" : "対戦相手の削除"}
                message={`「${deleteTarget?.name}」を削除しますか？\nこの操作は取り消せません。`}
                onConfirm={executeDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};