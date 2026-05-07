
import React from 'react';
import Layout, { HashRouter, Routes, Route } from './components/Layout';
import { toolDefinitions } from './components/toolRegistry';
import FavoritesPage from './components/tools/FavoritesPage';
import BrowsePage from './components/tools/BrowsePage';
import RecentlyUsedPage from './components/tools/RecentlyUsedPage';
import SettingsPage from './components/tools/SettingsPage';

const App: React.FC = () => {
  return (
		<HashRouter>
			<Layout>
				<Routes>
					<Route path="/" element={<BrowsePage />} />
					<Route path="/browse" element={<BrowsePage />} />
					<Route path="/favorites" element={<FavoritesPage />} />
					<Route path="/recent" element={<RecentlyUsedPage />} />
					<Route path="/settings" element={<SettingsPage />} />

					{toolDefinitions.map((tool) => {
						const ToolComponent = tool.component;
						return (
							<Route
								key={tool.path}
								path={tool.path}
								element={<ToolComponent />}
							/>
						);
					})}
				</Routes>
			</Layout>
		</HashRouter>
  );
};

export default App;
