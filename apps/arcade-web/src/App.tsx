import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PlayGame from './pages/PlayGame';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import MobileMenu from './components/MobileMenu';

const Layout = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();
    // Check if we are in gameplay mode to toggle UI elements
    const isGameplay = location.pathname.startsWith('/play/');

    return (
        <div className="flex min-h-screen">
            {/* Desktop Sidebar */}
            {!isGameplay && <Sidebar />}
            
            {/* Main Content Area */}
            <div className={`flex-1 transition-all duration-300 ${!isGameplay ? 'md:ml-64 mb-16 md:mb-0' : ''}`}>
                {children}
            </div>

            {/* Mobile Bottom Navigation */}
            {!isGameplay && <MobileMenu />}
        </div>
    );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:slug" element={<PlayGame />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Virtual Routes for filtering handled in Home */}
          <Route path="/trending" element={<Home />} />
          <Route path="/library" element={<Home />} />
          <Route path="/favorites" element={<Home />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;