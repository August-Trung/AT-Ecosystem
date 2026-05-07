
import React, { useState } from 'react';
import { Search, Calendar, Server, Shield, Globe, AlertTriangle, Database, Code, User, Building, Mail, MapPin } from 'lucide-react';
import { DomainWhoisInfo } from '../../types';

const DomainWhois = () => {
  const [domain, setDomain] = useState('');
  const [data, setData] = useState<DomainWhoisInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const lookupDomain = async () => {
    if (!domain) return;
    setLoading(true);
    setData(null);
    setError('');
    setShowRaw(false);

    // Basic cleanup
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();

    try {
      // Use RDAP via AllOrigins Proxy to bypass CORS
      const rdapUrl = `https://rdap.org/domain/${cleanDomain}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rdapUrl)}`;

      const res = await fetch(proxyUrl);
      
      if (res.status === 404) {
        throw new Error('Domain not found or not registered.');
      }
      if (!res.ok) {
        throw new Error('Lookup failed. TLD might not support RDAP or is rate limited.');
      }

      const json = await res.json();

      // --- Parse Helper ---
      const findVcardProp = (vcard: any[], propName: string) => {
        if (!vcard) return null;
        // vcard is like ["vcard", [ ["version",...], ["fn",...], ... ]]
        const props = vcard[1];
        if (!Array.isArray(props)) return null;
        const found = props.find((p: any) => p[0] === propName);
        return found ? found[3] : null;
      };

      // 1. Find Registrar
      let registrar = 'Unknown';
      const registrarEntity = json.entities?.find((e: any) => 
        e.roles?.includes('registrar')
      );
      if (registrarEntity && registrarEntity.vcardArray) {
        const fn = findVcardProp(registrarEntity.vcardArray, 'fn');
        if (fn) registrar = fn;
      }

      // 2. Find Registrant (Owner Info)
      let regName = 'Redacted / Privacy Protected';
      let regOrg = 'N/A';
      let regEmail = 'N/A';
      let regCountry = 'N/A';

      const registrantEntity = json.entities?.find((e: any) => 
        e.roles?.includes('registrant')
      );

      if (registrantEntity && registrantEntity.vcardArray) {
        const fn = findVcardProp(registrantEntity.vcardArray, 'fn');
        if (fn) regName = fn;

        const org = findVcardProp(registrantEntity.vcardArray, 'org');
        if (org) regOrg = org;

        const email = findVcardProp(registrantEntity.vcardArray, 'email');
        if (email) regEmail = email;

        // Address is complex in vCard: ["adr", {}, "text", [pobox, ext, street, city, region, zip, country]]
        const adrEntry = registrantEntity.vcardArray[1]?.find((p: any) => p[0] === 'adr');
        if (adrEntry && Array.isArray(adrEntry[3])) {
           // adrEntry[3][6] is usually Country
           regCountry = adrEntry[3][6] || adrEntry[3][4] || 'N/A'; 
        }
      }

      // 3. Find Dates
      let created = 'N/A';
      let expired = 'N/A';
      let updated = 'N/A';
      
      if (json.events) {
        json.events.forEach((evt: any) => {
          if (evt.eventAction === 'registration') created = evt.eventDate;
          if (evt.eventAction === 'expiration') expired = evt.eventDate;
          if (evt.eventAction === 'last changed') updated = evt.eventDate;
        });
      }

      // 4. Name Servers
      const ns = json.nameservers?.map((n: any) => n.ldhName) || [];

      setData({
        domainName: json.ldhName || cleanDomain,
        registrar,
        creationDate: created,
        expirationDate: expired,
        updatedDate: updated,
        nameServers: ns,
        status: json.status || [],
        dnssec: json.secureDNS?.delegationSigned ? 'Signed' : 'Unsigned',
        registrant: {
          name: regName,
          organization: regOrg,
          email: regEmail,
          country: regCountry
        },
        raw: json
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred during lookup.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === 'N/A') return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Search className="text-pink-500" /> Domain Whois</h2>

      <div className="flex gap-2 mb-8">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookupDomain()}
          placeholder="Enter Domain (e.g., google.com)"
          className="flex-1 bg-dark-800 border border-dark-700 rounded-lg p-3 outline-none focus:border-pink-500 transition-colors text-white placeholder-gray-600"
        />
        <button
          onClick={lookupDomain}
          disabled={loading}
          className="px-6 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2 min-w-[100px] justify-center"
        >
          {loading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : 'Search'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-400 flex items-center justify-center gap-2 mb-6 animate-in fade-in">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {data && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden animate-in fade-in zoom-in-95 shadow-xl shadow-pink-900/10">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-dark-800 to-dark-700 border-b border-dark-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Globe className="text-pink-400" size={20} />
              <span className="font-mono text-xl font-bold text-white tracking-wide uppercase">{data.domainName}</span>
            </div>
            <div className="flex gap-2">
               {data.status.includes('clientTransferProhibited') && <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded border border-yellow-500/20">Locked</span>}
               <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">Active</span>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
             <button
              onClick={() => setShowRaw(!showRaw)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
              title="View Raw RDAP JSON"
            >
              <Code size={16} />
            </button>
             
             {/* REGISTRANT INFO SECTION */}
             <div className="col-span-1 md:col-span-2 bg-dark-900/40 rounded-xl p-4 border border-dark-700/50">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <User size={14} /> Registrant (Owner) Info
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                     <div className="p-1.5 bg-dark-800 rounded text-pink-400"><User size={16}/></div>
                     <div className="overflow-hidden">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Name</p>
                        <p className="text-sm font-bold text-white truncate" title={data.registrant.name}>{data.registrant.name}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-2">
                     <div className="p-1.5 bg-dark-800 rounded text-pink-400"><Building size={16}/></div>
                     <div className="overflow-hidden">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Organization</p>
                        <p className="text-sm text-gray-300 truncate" title={data.registrant.organization}>{data.registrant.organization}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-2">
                     <div className="p-1.5 bg-dark-800 rounded text-pink-400"><Mail size={16}/></div>
                     <div className="overflow-hidden">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Email</p>
                        <p className="text-sm text-gray-300 truncate" title={data.registrant.email}>{data.registrant.email}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-2">
                     <div className="p-1.5 bg-dark-800 rounded text-pink-400"><MapPin size={16}/></div>
                     <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Location</p>
                        <p className="text-sm text-gray-300">{data.registrant.country}</p>
                     </div>
                  </div>
                </div>
                {data.registrant.name.toLowerCase().includes('redacted') && (
                   <div className="mt-3 text-[10px] text-yellow-500/80 italic flex items-center gap-1">
                      <AlertTriangle size={10} /> Privacy Protection Enabled (GDPR/WhoisGuard)
                   </div>
                )}
             </div>

             {/* Registrar */}
             <div className="col-span-1 md:col-span-2 flex items-start gap-4 p-4 bg-dark-900/50 rounded-xl border border-dark-700">
                <div className="p-2 bg-dark-800 rounded-lg text-blue-400"><Shield size={24}/></div>
                <div>
                   <p className="text-gray-500 text-xs uppercase font-bold mb-1">Registrar</p>
                   <p className="text-white font-bold text-lg">{data.registrar}</p>
                </div>
             </div>

             {/* Dates */}
             <div className="space-y-4">
                <div className="flex items-start gap-3">
                   <Calendar size={18} className="text-gray-500 mt-0.5" />
                   <div>
                      <p className="text-gray-500 text-xs uppercase font-bold">Registered On</p>
                      <p className="text-white">{formatDate(data.creationDate)}</p>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <Calendar size={18} className="text-red-400 mt-0.5" />
                   <div>
                      <p className="text-gray-500 text-xs uppercase font-bold">Expires On</p>
                      <p className="text-red-400 font-bold">{formatDate(data.expirationDate)}</p>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <Calendar size={18} className="text-gray-500 mt-0.5" />
                   <div>
                      <p className="text-gray-500 text-xs uppercase font-bold">Last Updated</p>
                      <p className="text-gray-300">{formatDate(data.updatedDate)}</p>
                   </div>
                </div>
             </div>

             {/* Name Servers */}
             <div>
                <div className="flex items-center gap-2 mb-3">
                   <Server size={18} className="text-blue-400" />
                   <p className="text-gray-500 text-xs uppercase font-bold">Name Servers</p>
                </div>
                <ul className="space-y-2">
                   {data.nameServers.length > 0 ? data.nameServers.map((ns, i) => (
                      <li key={i} className="text-sm font-mono text-gray-300 bg-dark-900 px-2 py-1 rounded">{ns}</li>
                   )) : <li className="text-gray-500 italic">No Name Servers found</li>}
                </ul>
             </div>
          </div>
          
           {showRaw && (
            <div className="border-t border-dark-700 bg-black/50 p-4">
              <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-bold uppercase">
                <Database size={12} /> Raw RDAP Response
              </div>
              <pre className="text-xs font-mono text-green-400 overflow-x-auto bg-dark-900 p-4 rounded-lg border border-dark-800">
                {JSON.stringify(data.raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DomainWhois;
