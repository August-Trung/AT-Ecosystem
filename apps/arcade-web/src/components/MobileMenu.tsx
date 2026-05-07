import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, Settings, Gamepad2 } from 'lucide-react';

const MobileMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ icon: Icon, path }: { icon: any, path: string }) => (
    <button
      onClick={() => navigate(path)}
      className={`relative p-3 rounded-xl transition-all ${
        isActive(path) 
          ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
          : 'text-slate-500 hover:text-white'
      }`}
    >
      <Icon size={24} className={isActive(path) ? 'text-purple-400' : ''} />
      {isActive(path) && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-500 rounded-full"></span>
      )}
    </button>
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0e]/95 backdrop-blur-xl border-t border-white/5 pb-6 pt-2 z-50 px-4 safe-area-bottom">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        <NavItem icon={Home} path="/" />
        
        {/* Central Play Button acts as Library/Home */}
        <div className="relative -top-6">
            <button 
                onClick={() => navigate('/library')}
                className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)] border-[6px] border-[#0a0a0e] transform transition-transform active:scale-95"
            >
                <Gamepad2 size={28} className="text-white fill-white/20" />
            </button>
        </div>

        <NavItem icon={Heart} path="/favorites" />
        <NavItem icon={Settings} path="/settings" />
      </div>
    </div>
  );
};

export default MobileMenu;