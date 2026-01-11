
import React, { useState } from 'react';
import { InputForm } from './components/InputForm';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { HistoryTab } from './components/HistoryTab';
import { TabView } from './types';
import { Edit3, BarChart2, Database, BrainCircuit, Settings as SettingsIcon } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.INPUT);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row">
      
      {/* Sidebar (Desktop) / Topbar (Mobile) */}
      <aside className="bg-team-navy text-white md:w-64 md:h-screen md:sticky md:top-0 flex flex-col shadow-xl z-50">
          
          <nav className="flex-1 p-4 space-y-2 hidden md:block mt-6">
              <button onClick={() => setActiveTab(TabView.INPUT)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${activeTab===TabView.INPUT ? 'bg-white text-team-navy' : 'text-slate-300 hover:bg-white/10'}`}>
                  <Edit3 size={20}/> データ入力
              </button>
              <button onClick={() => setActiveTab(TabView.DASHBOARD)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${activeTab===TabView.DASHBOARD ? 'bg-white text-team-navy' : 'text-slate-300 hover:bg-white/10'}`}>
                  <BarChart2 size={20}/> 成績分析
              </button>
              <button onClick={() => setActiveTab(TabView.DATA)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${activeTab===TabView.DATA ? 'bg-white text-team-navy' : 'text-slate-300 hover:bg-white/10'}`}>
                  <Database size={20}/> 履歴管理
              </button>
              <button onClick={() => setActiveTab(TabView.SETTINGS)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${activeTab===TabView.SETTINGS ? 'bg-white text-team-navy' : 'text-slate-300 hover:bg-white/10'}`}>
                  <SettingsIcon size={20}/> 設定・登録
              </button>
          </nav>

          {/* Mobile Header (Only visible on small screens) */}
          <div className="md:hidden flex justify-between p-4 items-center overflow-x-auto">
             <div className="flex gap-4 text-sm font-bold whitespace-nowrap">
                 <button onClick={() => setActiveTab(TabView.INPUT)} className={activeTab===TabView.INPUT ? 'text-white border-b-2 border-white pb-1' : 'text-slate-400'}>入力</button>
                 <button onClick={() => setActiveTab(TabView.DASHBOARD)} className={activeTab===TabView.DASHBOARD ? 'text-white border-b-2 border-white pb-1' : 'text-slate-400'}>分析</button>
                 <button onClick={() => setActiveTab(TabView.DATA)} className={activeTab===TabView.DATA ? 'text-white border-b-2 border-white pb-1' : 'text-slate-400'}>履歴</button>
                 <button onClick={() => setActiveTab(TabView.SETTINGS)} className={activeTab===TabView.SETTINGS ? 'text-white border-b-2 border-white pb-1' : 'text-slate-400'}>設定</button>
             </div>
          </div>

          <div className="p-4 border-t border-slate-700 hidden md:block">
              <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">PRO Plan (Demo)</p>
                  <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold">
                      <BrainCircuit size={14}/> AI分析機能 (Coming Soon)
                  </div>
              </div>
          </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
            {/* 
               InputForm is kept mounted (display: none) to preserve state when switching tabs.
               Other tabs are unmounted to ensure they re-fetch fresh data when clicked.
            */}
            <div style={{ display: activeTab === TabView.INPUT ? 'block' : 'none' }}>
                <InputForm />
            </div>
            {activeTab === TabView.DASHBOARD && <Dashboard />}
            {activeTab === TabView.DATA && <HistoryTab />}
            {activeTab === TabView.SETTINGS && <Settings />}
        </div>
      </main>

    </div>
  );
};

export default App;
