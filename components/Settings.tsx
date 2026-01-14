
import React, { useState, useEffect } from 'react';
import { Player, Opponent } from '../types';
import { getPlayers, savePlayer, deletePlayer, getOpponents, saveOpponent, deleteOpponent, generateUUID, getAllDataJSON, importDataJSON, resyncAllDataToFirebase } from '../services/dataService';
import { User, Trash2, Plus, Users, Shield, Download, Upload, Save, AlertTriangle, UserPlus, CloudUpload } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export const Settings: React.FC = () => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [opponents, setOpponents] = useState<Opponent[]>([]);

    // View State
    const [activeTab, setActiveTab] = useState<'my_team' | 'opponents'>('my_team');
    const [selectedOpponentId, setSelectedOpponentId] = useState<string>('');

    // Player Form State
    const [pName, setPName] = useState('');
    const [pNumber, setPNumber] = useState('');
    const [pPosition, setPPosition] = useState('');
    const [pType, setPType] = useState<'batter'|'pitcher'|'two-way'>('batter');
    const [pThrows, setPThrows] = useState<'R'|'L'>('R');
    const [pBats, setPBats] = useState<'R'|'L'|'S'>('R');

    // Opponent Form State
    const [oName, setOName] = useState('');

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{type: 'player'|'opponent', id: string, name: string} | null>(null);

    // Import State
    const [importStatus, setImportStatus] = useState<string>('');
    const [isImportError, setIsImportError] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setPlayers(getPlayers());
        const opps = getOpponents();
        setOpponents(opps);
        // Default select first opponent if none selected and opps exist
        if (!selectedOpponentId && opps.length > 0) {
            setSelectedOpponentId(opps[0].id);
        }
    };

    const handleAddPlayer = (teamId?: string) => {
        if(!pName || !pNumber) return;
        const newPlayer: Player = {
            id: generateUUID(),
            name: pName,
            number: pNumber,
            position: pPosition || '', // Allow empty or free text
            type: pType,
            throws: pThrows,
            bats: pBats,
            teamId: teamId // Undefined for My Team
        };
        savePlayer(newPlayer);
        setPName(''); setPNumber(''); setPPosition('');
        // Reset defaults
        setPThrows('R'); setPBats('R');
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
        // Set new one as active
        setSelectedOpponentId(newOpp.id);
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
            // Also delete players associated? Maybe too dangerous for auto. 
            // For now, players will be orphaned or hidden. Ideally, clean up.
            if (selectedOpponentId === deleteTarget.id) setSelectedOpponentId('');
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

    const handleResync = async () => {
        if (!confirm("手元の全データをクラウド(Firebase)に強制アップロードします。\nクラウド上の既存データは上書きされますがよろしいですか？")) return;
        
        setIsSyncing(true);
        setImportStatus('クラウド同期中...');
        setIsImportError(false);
        
        const resultMsg = await resyncAllDataToFirebase();
        setImportStatus(resultMsg);
        setIsSyncing(false);
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

        e.target.value = '';
    };

    // Derived Lists
    const myTeamPlayers = players.filter(p => !p.teamId);
    const selectedOpponentPlayers = selectedOpponentId ? players.filter(p => p.teamId === selectedOpponentId) : [];

    return (
        <div className="pb-20 max-w-5xl mx-auto space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-team-navy">設定・マスタ管理</h2>

            {/* Main Tabs */}
            <div className="flex border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('my_team')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition ${activeTab === 'my_team' ? 'border-team-navy text-team-navy' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    自チーム選手管理
                </button>
                <button 
                    onClick={() => setActiveTab('opponents')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition ${activeTab === 'opponents' ? 'border-team-navy text-team-navy' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    対戦相手・選手管理
                </button>
            </div>

            {/* --- MY TEAM TAB --- */}
            {activeTab === 'my_team' && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700"><Users size={20}/> 自チーム選手名鑑</h3>
                    
                    {/* Add Form */}
                    <div className="grid grid-cols-12 gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="col-span-4">
                            <label className="text-xs font-bold text-slate-500">選手名</label>
                            <input type="text" value={pName} onChange={e=>setPName(e.target.value)} placeholder="例: 佐藤 健太" className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-slate-500">背番号</label>
                            <input type="text" value={pNumber} onChange={e=>setPNumber(e.target.value)} placeholder="1" className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div className="col-span-3">
                            <label className="text-xs font-bold text-slate-500">守備 (自由入力)</label>
                            <input 
                                type="text" 
                                value={pPosition} 
                                onChange={e=>setPPosition(e.target.value)} 
                                placeholder="例: P/外, 内野全般" 
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div className="col-span-3">
                             <label className="text-xs font-bold text-slate-500">タイプ</label>
                             <select value={pType} onChange={e=>setPType(e.target.value as any)} className="w-full p-2 border rounded text-sm">
                                <option value="batter">野手</option>
                                <option value="pitcher">投手</option>
                                <option value="two-way">二刀流</option>
                            </select>
                        </div>
                        
                        {/* New: Throws / Bats */}
                        <div className="col-span-6 md:col-span-3">
                            <label className="text-xs font-bold text-slate-500">投</label>
                            <div className="flex gap-2">
                                <label className="flex items-center text-sm cursor-pointer">
                                    <input type="radio" name="throws" value="R" checked={pThrows==='R'} onChange={()=>setPThrows('R')} className="mr-1"/>右
                                </label>
                                <label className="flex items-center text-sm cursor-pointer">
                                    <input type="radio" name="throws" value="L" checked={pThrows==='L'} onChange={()=>setPThrows('L')} className="mr-1"/>左
                                </label>
                            </div>
                        </div>
                        <div className="col-span-6 md:col-span-3">
                            <label className="text-xs font-bold text-slate-500">打</label>
                            <div className="flex gap-2">
                                <label className="flex items-center text-sm cursor-pointer">
                                    <input type="radio" name="bats" value="R" checked={pBats==='R'} onChange={()=>setPBats('R')} className="mr-1"/>右
                                </label>
                                <label className="flex items-center text-sm cursor-pointer">
                                    <input type="radio" name="bats" value="L" checked={pBats==='L'} onChange={()=>setPBats('L')} className="mr-1"/>左
                                </label>
                                <label className="flex items-center text-sm cursor-pointer">
                                    <input type="radio" name="bats" value="S" checked={pBats==='S'} onChange={()=>setPBats('S')} className="mr-1"/>両
                                </label>
                            </div>
                        </div>

                        <div className="col-span-12 mt-2">
                            <button onClick={() => handleAddPlayer(undefined)} className="w-full py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 flex items-center justify-center gap-2">
                                <Plus size={16}/> 自チーム選手を追加
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {myTeamPlayers.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold bg-slate-200 w-8 h-8 flex items-center justify-center rounded-full text-slate-600 text-sm">{p.number}</span>
                                    <div>
                                        <div className="font-bold text-sm text-team-navy">{p.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {p.position ? p.position : '守備未登録'} 
                                            <span className="mx-1">/</span> 
                                            {p.type==='batter'?'野手':p.type==='pitcher'?'投手':'二刀流'}
                                            <span className="ml-2 bg-slate-100 px-1 rounded text-[10px] border">{p.throws}投{p.bats}打</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={()=>handleDeletePlayerClick(p)} className="text-slate-300 hover:text-red-500 p-2">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- OPPONENTS TAB --- */}
            {activeTab === 'opponents' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Team List */}
                    <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700"><Shield size={20}/> チーム一覧</h3>
                        
                        <div className="flex gap-2 bg-slate-50 p-2 rounded-lg items-center">
                            <input type="text" value={oName} onChange={e=>setOName(e.target.value)} placeholder="チーム名" className="flex-1 p-2 border rounded text-sm"/>
                            <button onClick={handleAddOpponent} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Plus size={16}/></button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-1">
                             {opponents.map(o => (
                                <div 
                                    key={o.id} 
                                    onClick={() => setSelectedOpponentId(o.id)}
                                    className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition ${selectedOpponentId === o.id ? 'bg-team-navy text-white' : 'hover:bg-slate-50 border'}`}
                                >
                                    <span className="font-bold text-sm">{o.name}</span>
                                    <button onClick={(e)=>{e.stopPropagation(); handleDeleteOpponentClick(o);}} className={`p-1 ${selectedOpponentId === o.id ? 'text-slate-400 hover:text-white' : 'text-slate-300 hover:text-red-500'}`}>
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                             ))}
                             {opponents.length === 0 && <div className="text-sm text-slate-400 text-center py-4">登録なし</div>}
                        </div>
                    </div>

                    {/* Right: Player List for Selected Team */}
                    <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        {selectedOpponentId ? (
                            <>
                                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700">
                                    <UserPlus size={20}/> 
                                    {opponents.find(o => o.id === selectedOpponentId)?.name} 所属選手
                                </h3>

                                {/* Add Opponent Player Form */}
                                <div className="grid grid-cols-12 gap-2 bg-red-50 p-4 rounded-lg border border-red-100">
                                    <div className="col-span-5">
                                        <label className="text-xs font-bold text-slate-500">選手名</label>
                                        <input type="text" value={pName} onChange={e=>setPName(e.target.value)} placeholder="相手選手名" className="w-full p-2 border rounded text-sm"/>
                                    </div>
                                    <div className="col-span-3">
                                        <label className="text-xs font-bold text-slate-500">背番号</label>
                                        <input type="text" value={pNumber} onChange={e=>setPNumber(e.target.value)} placeholder="#" className="w-full p-2 border rounded text-sm"/>
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-xs font-bold text-slate-500">投/打</label>
                                        <div className="flex gap-2 text-xs">
                                            <select value={pThrows} onChange={e=>setPThrows(e.target.value as any)} className="border rounded p-1">
                                                <option value="R">右投</option><option value="L">左投</option>
                                            </select>
                                            <select value={pBats} onChange={e=>setPBats(e.target.value as any)} className="border rounded p-1">
                                                <option value="R">右打</option><option value="L">左打</option><option value="S">両打</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="col-span-12 mt-2">
                                        <button onClick={() => handleAddPlayer(selectedOpponentId)} className="w-full py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700 flex items-center justify-center gap-2">
                                            <Plus size={16}/> 追加
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-[300px] overflow-y-auto space-y-2">
                                    {selectedOpponentPlayers.length === 0 ? (
                                        <p className="text-center text-slate-400 py-4 text-sm">選手が登録されていません</p>
                                    ) : (
                                        selectedOpponentPlayers.map(p => (
                                            <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold bg-slate-200 w-8 h-8 flex items-center justify-center rounded-full text-slate-600 text-sm">{p.number}</span>
                                                    <div className="font-bold text-sm text-team-navy">{p.name}</div>
                                                    <span className="text-xs text-slate-400 bg-white border px-1 rounded">{p.throws}投{p.bats}打</span>
                                                </div>
                                                <button onClick={()=>handleDeletePlayerClick(p)} className="text-slate-300 hover:text-red-500 p-2">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                左のリストからチームを選択してください
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- System Backup/Restore (Keep at bottom) --- */}
            <div className="bg-slate-800 text-white p-6 rounded-xl border border-slate-700 shadow-sm space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Save size={20}/> データバックアップ・共有</h3>
                <p className="text-sm text-slate-300">
                    入力データは端末内に保存されています。クラウド(Firebase)が消えても、ここから再同期やファイル保存が可能です。
                </p>
                
                <div className="flex flex-col md:flex-row gap-4 pt-2">
                    {/* 1. Cloud Resync */}
                    <button 
                        onClick={handleResync} 
                        disabled={isSyncing}
                        className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                        <CloudUpload size={18}/> 
                        {isSyncing ? '同期中...' : 'クラウドと再同期 (強制アップロード)'}
                    </button>

                    {/* 2. File Backup */}
                    <button onClick={handleBackup} className="flex-1 py-3 px-4 bg-white text-team-navy font-bold rounded-lg shadow hover:bg-slate-100 flex items-center justify-center gap-2 transition">
                        <Download size={18}/> ファイルに保存 (Backup)
                    </button>
                    
                    {/* 3. Restore */}
                    <div className="flex-1 relative">
                        <input 
                            type="file" 
                            accept=".json"
                            onChange={handleFileSelect}
                            onClick={(e) => (e.currentTarget.value = '')} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="w-full h-full py-3 px-4 bg-slate-700 text-white font-bold rounded-lg border border-slate-600 hover:bg-slate-600 flex items-center justify-center gap-2 transition pointer-events-none">
                            <Upload size={18}/> ファイルから復元
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
