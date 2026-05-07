
import React, { useState, useEffect } from 'react';
import { Globe, AlertTriangle, MapPin, Network, Server, Code, Database, Copy, Check } from 'lucide-react';
import { WhoisData } from '../../types';

const WhoisLookup = () => {
  const [ipData, setIpData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  const fetchIp = async (target?: string) => {
    setLoading(true);
    setIpData(null);
    setError('');
    setShowRaw(false);

    const isSelfLookup = !target || target.trim() === '';
    const targetIp = target ? target.trim() : '';
    let success = false;

    try {
      // STRATEGY: Waterfall Approach
      // 1. ipwho.is (Best free tier, rich data, lenient limits)
      // 2. ipapi.co (High quality, but strict rate limits/CORS)
      // 3. ipinfo.io (Very reliable for Self Lookup, limited fields free)
      // 4. freeipapi.com (Good backup)
      // 5. Proxy -> ip-api.com (Last resort)

      // --- 1. ipwho.is ---
      if (!success) {
        try {
          const url = isSelfLookup
            ? `https://ipwho.is/`
            : `https://ipwho.is/${targetIp}`;

          const res = await fetch(url, { referrerPolicy: 'no-referrer' });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              const asnStr = data.connection?.asn ? `AS${data.connection.asn}` : '';

              setIpData({
                ip: data.ip,
                city: data.city,
                region: data.region,
                country: data.country,
                org: data.connection?.org || data.connection?.isp,
                asn: asnStr,
                lat: data.latitude,
                lon: data.longitude,
                source: 'ipwho.is',
                raw: data
              });
              success = true;
            }
          }
        } catch (e) { console.debug("ipwho.is skipped", e); }
      }

      // --- 2. ipapi.co ---
      if (!success) {
        try {
          const url = isSelfLookup
            ? `https://ipapi.co/json/`
            : `https://ipapi.co/${targetIp}/json/`;

          const res = await fetch(url, { referrerPolicy: 'no-referrer' });
          if (res.ok) {
            const data = await res.json();
            if (!data.error && !data.reserved) {
              setIpData({
                ip: data.ip,
                city: data.city,
                region: data.region,
                country: data.country_name,
                org: data.org,
                asn: data.asn,
                lat: data.latitude,
                lon: data.longitude,
                source: 'ipapi.co',
                raw: data
              });
              success = true;
            }
          }
        } catch (e) { console.debug("ipapi.co skipped", e); }
      }

      // --- 3. ipinfo.io (Self Lookup Fallback) ---
      if (!success && isSelfLookup) {
        try {
          const res = await fetch('https://ipinfo.io/json', { referrerPolicy: 'no-referrer' });
          if (res.ok) {
            const data = await res.json();
            // ipinfo returns loc as "lat,lon" string
            const [lat, lon] = (data.loc || '').split(',').map(Number);

            setIpData({
              ip: data.ip,
              city: data.city,
              region: data.region,
              country: data.country,
              org: data.org,
              asn: data.org, // ipinfo mixes org/asn often
              lat: lat || 0,
              lon: lon || 0,
              source: 'ipinfo.io',
              raw: data
            });
            success = true;
          }
        } catch (e) { console.debug("ipinfo.io skipped", e); }
      }

      // --- 4. freeipapi.com (Backup) ---
      if (!success) {
        try {
          const url = isSelfLookup
            ? 'https://freeipapi.com/api/json'
            : `https://freeipapi.com/api/json/${targetIp}`;

          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            setIpData({
              ip: data.ipAddress,
              city: data.cityName,
              region: data.regionName,
              country: data.countryName,
              org: data.isp,
              asn: '',
              lat: data.latitude,
              lon: data.longitude,
              source: 'freeipapi.com',
              raw: data
            });
            success = true;
          }
        } catch (e) { console.debug("freeipapi skipped", e); }
      }

      // --- 5. Proxy Fallback (Target) ---
      if (!success && targetIp) {
        try {
          const rawUrl = `http://ip-api.com/json/${targetIp}?fields=status,message,country,regionName,city,isp,org,as,query,lat,lon`;
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;

          const res = await fetch(proxyUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
              const [asnPart] = (data.as || '').split(' ');
              setIpData({
                ip: data.query,
                city: data.city,
                region: data.regionName,
                country: data.country,
                org: data.isp,
                asn: asnPart,
                lat: data.lat,
                lon: data.lon,
                source: 'ip-api.com (proxy)',
                raw: data
              });
              success = true;
            }
          }
        } catch (e) { console.debug("proxy skipped", e); }
      }

      if (!success) {
        throw new Error('All providers failed. Please disable AdBlock or check network.');
      }

    } catch (error: any) {
      console.error(error);
      setError(error.message || 'Lookup Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIp();
  }, []);

  const formatLocation = () => {
    if (!ipData) return 'Unknown';
    const mainLoc = ipData.city || ipData.region || 'Unknown Location';
    return ipData.city && ipData.region && ipData.city !== ipData.region
      ? `${ipData.city}, ${ipData.region}`
      : mainLoc;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Globe className="text-blue-500" /> IP & Location Lookup</h2>

      <div className="flex gap-2 mb-8">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchIp(input)}
          placeholder="Enter IP Address (leave empty for yours)"
          className="flex-1 bg-dark-800 border border-dark-700 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors text-white placeholder-gray-600"
        />
        <button
          onClick={() => fetchIp(input)}
          disabled={loading}
          className="px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2 min-w-[100px] justify-center"
        >
          {loading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : 'Lookup'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-400 flex items-center justify-center gap-2 mb-6 animate-in fade-in">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {ipData && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden animate-in fade-in zoom-in-95 shadow-xl shadow-blue-900/10">

          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-dark-800 to-dark-700 border-b border-dark-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Globe className="text-blue-400" size={20} />
              <div>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-bold text-white tracking-wide">{ipData.ip}</span>
                    <button 
                        onClick={() => {
                            if (ipData.ip) {
                                navigator.clipboard.writeText(ipData.ip);
                                setCopiedIp(true);
                                setTimeout(() => setCopiedIp(false), 2000);
                            }
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Copy IP"
                    >
                        {copiedIp ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                    </button>
                </div>
                {ipData.source && <span className="text-xs text-gray-500 bg-dark-900 px-2 py-0.5 rounded border border-dark-600 block w-fit mt-1">Source: {ipData.source}</span>}
              </div>
            </div>
            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20 font-bold uppercase tracking-wider">
              Active
            </span>
          </div>

          {/* Info Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 relative">

            <div className="flex items-start gap-3">
              <div className="p-2 bg-dark-900 rounded-lg text-blue-400"><MapPin size={20} /></div>
              <div>
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">Location</p>
                <p className="text-white font-medium text-lg leading-tight">{formatLocation()}</p>
                <p className="text-gray-400 text-sm mt-0.5">{ipData.country}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-dark-900 rounded-lg text-purple-400"><Network size={20} /></div>
              <div>
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">ISP / Organization</p>
                <p className="text-white font-medium">{ipData.org || 'Unknown ISP'}</p>
              </div>
            </div>

            <div className="md:col-span-2 flex items-start gap-3 bg-dark-900/50 p-3 rounded-xl border border-dark-700/50">
              <div className="p-2 bg-dark-800 rounded-lg text-green-400"><Server size={20} /></div>
              <div>
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">ASN (Autonomous System)</p>
                <div className="flex items-center gap-2">
                  <p className="text-white font-mono font-bold">{ipData.asn || 'N/A'}</p>
                  {ipData.asn && ipData.org && <span className="text-gray-500 text-sm">- {ipData.org}</span>}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowRaw(!showRaw)}
              className="absolute top-0 right-0 p-2 text-gray-500 hover:text-white transition-colors"
              title="View Raw JSON"
            >
              <Code size={16} />
            </button>
          </div>

          {showRaw && (
            <div className="border-t border-dark-700 bg-black/50 p-4">
              <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-bold uppercase">
                <Database size={12} /> Raw Data Response ({ipData.source})
              </div>
              <pre className="text-xs font-mono text-green-400 overflow-x-auto bg-dark-900 p-4 rounded-lg border border-dark-800">
                {JSON.stringify(ipData.raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhoisLookup;
