import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/index";
import NotFound from "./pages/NotFound";
import Events from "./pages/Events";
import Valentine from "./pages/Valentine";
import Christmas from "./pages/Christmas";
import Anniversary from "./pages/Anniversary";
import LunarFestival from "./pages/LunarFestival";
import Birthday from "./pages/Birthday";
import Album from "./pages/Album";
import LoveQuoteManager from "./components/LoveQuoteManager";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<TooltipProvider>
			<Sonner />
			<Routes>
				<Route path="/" element={<Index />} />
				<Route path="/album" element={<Album />} />
				<Route path="/events" element={<Events />} />
				<Route path="/love-quotes" element={<LoveQuoteManager />} />
				<Route path="/events/valentine" element={<Valentine />} />
				<Route path="/events/christmas" element={<Christmas />} />
				<Route path="/events/anniversary" element={<Anniversary />} />
				<Route
					path="/events/lunar-festival"
					element={<LunarFestival />}
				/>
				<Route path="/events/birthday" element={<Birthday />} />
				{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
				<Route path="*" element={<NotFound />} />
			</Routes>
		</TooltipProvider>
	</QueryClientProvider>
);

export default App;
