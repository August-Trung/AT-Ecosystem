import React, { useState, useEffect } from 'react';
import { Monitor, Shield, Bell, Smartphone, LogOut, ChevronRight, Gamepad2, X } from 'lucide-react';

const Settings: React.FC = () => {
  // Initialize state from LocalStorage
  const [notifications, setNotifications] = useState(() => localStorage.getItem('setting_notif') !== 'false');
  const [highPerformance, setHighPerformance] = useState(() => localStorage.getItem('setting_perf') !== 'false');
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('setting_autosave') !== 'false');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Persist changes to LocalStorage
  useEffect(() => { localStorage.setItem('setting_notif', String(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('setting_perf', String(highPerformance)); }, [highPerformance]);
  useEffect(() => { localStorage.setItem('setting_autosave', String(autoSave)); }, [autoSave]);

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all data? This will clear favorites, history, and premium status.")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 mt-8 px-2">{title}</h3>
  );

  const SettingItem = ({ icon: Icon, title, subtitle, children, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-[#12121a] border border-white/5 rounded-2xl mb-3 transition-colors group ${onClick ? 'cursor-pointer hover:border-purple-500/30' : 'hover:border-white/10'}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/10 group-hover:text-purple-300 transition-colors">
          <Icon size={20} />
        </div>
        <div>
          <h4 className="text-white font-medium">{title}</h4>
          {subtitle && <p className="text-slate-500 text-xs">{subtitle}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );

  const Toggle = ({ checked, onChange }: any) => (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${
        checked ? 'bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-slate-700'
      }`}
    >
      <div
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen pb-32 p-6 md:p-10 max-w-4xl mx-auto animate-fade-in-up relative">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your game preferences and account.</p>
      </header>

      <SectionTitle title="General" />
      
      <SettingItem 
        icon={Bell} 
        title="Notifications" 
        subtitle="Get updates on new games"
      >
        <Toggle checked={notifications} onChange={setNotifications} />
      </SettingItem>

      <SettingItem 
        icon={Gamepad2} 
        title="Auto-Save Progress" 
        subtitle="Save game state automatically"
      >
        <Toggle checked={autoSave} onChange={setAutoSave} />
      </SettingItem>

      <SectionTitle title="Graphics & Performance" />

      <SettingItem 
        icon={Monitor} 
        title="High Quality Mode" 
        subtitle="Better graphics, higher usage"
      >
        <Toggle checked={highPerformance} onChange={setHighPerformance} />
      </SettingItem>
      
      <SettingItem 
        icon={Smartphone} 
        title="Mobile Optimization" 
        subtitle="Active on touch devices"
      >
        <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded border border-green-400/20">Active</span>
      </SettingItem>

      <SectionTitle title="System & Privacy" />

      <SettingItem 
        icon={Shield} 
        title="Privacy Policy" 
        subtitle="Read our terms of service"
        onClick={() => setShowPrivacyModal(true)}
      >
        <ChevronRight className="text-slate-600 group-hover:text-purple-400 transition-colors" size={20} />
      </SettingItem>

      <button 
        onClick={handleReset}
        className="w-full mt-10 p-4 rounded-2xl border border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all flex items-center justify-center gap-2 font-bold cursor-pointer"
      >
        <LogOut size={20} />
        Reset All Settings
      </button>

      <div className="text-center mt-12 space-y-2">
        <p className="text-slate-500 text-sm font-medium">Web developed by <span className="text-purple-400">AugustTrung</span></p>
        <p className="text-slate-600 text-xs">Games sourced from external providers</p>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPrivacyModal(false)}></div>
          <div className="bg-[#1a1a24] w-full max-w-2xl max-h-[80vh] rounded-3xl border border-white/10 shadow-2xl relative flex flex-col animate-fade-in-up">
            
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                    <Shield size={24} />
                 </div>
                 <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
              </div>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar text-slate-300 space-y-6 text-sm leading-relaxed">
              <section>
                <h3 className="text-white font-bold text-lg mb-2">1. Introduction</h3>
                <p>Welcome to AugustTrung Arcade. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we handle your data.</p>
              </section>

              <section>
                <h3 className="text-white font-bold text-lg mb-2">2. Data Collection</h3>
                <p>We do not collect any personal data on our servers. All data regarding your preferences, favorites, and game history is stored locally on your device using <code>localStorage</code>.</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
                    <li><strong>Favorites:</strong> Stored locally in your browser.</li>
                    <li><strong>History:</strong> Recent games are saved to your device.</li>
                    <li><strong>Settings:</strong> System preferences are persisted locally.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-white font-bold text-lg mb-2">3. External Content</h3>
                <p>The games provided on this platform are sourced from external developers and run within isolated environments (iframes). We do not control the data collection practices of these individual third-party games.</p>
              </section>

              <section>
                <h3 className="text-white font-bold text-lg mb-2">4. User Rights</h3>
                <p>Since data is stored locally, you have full control. You can clear your browser cache or use the "Reset All Settings" button to wipe all stored data associated with this website.</p>
              </section>
              
              <div className="p-4 bg-purple-900/10 border border-purple-500/20 rounded-xl">
                  <p className="text-xs text-purple-300">Last updated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="p-6 border-t border-white/5 flex justify-end">
                <button 
                    onClick={() => setShowPrivacyModal(false)}
                    className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-slate-200 transition-colors"
                >
                    Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;