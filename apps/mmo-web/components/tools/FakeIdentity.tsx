
import React, { useState, useEffect } from 'react';
import { User, MapPin, Phone, Briefcase, Calendar, Hash, RefreshCw, Copy, Check } from 'lucide-react';

const FakeIdentity = () => {
  const [profile, setProfile] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Mini Database
  const FIRST_NAMES = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'];
  const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
  const CITIES = [
    { city: 'New York', state: 'NY', zip: '10001' },
    { city: 'Los Angeles', state: 'CA', zip: '90001' },
    { city: 'Chicago', state: 'IL', zip: '60601' },
    { city: 'Houston', state: 'TX', zip: '77001' },
    { city: 'Phoenix', state: 'AZ', zip: '85001' },
    { city: 'Philadelphia', state: 'PA', zip: '19019' },
    { city: 'San Antonio', state: 'TX', zip: '78201' },
    { city: 'San Diego', state: 'CA', zip: '92101' },
    { city: 'Dallas', state: 'TX', zip: '75201' },
    { city: 'San Jose', state: 'CA', zip: '95101' }
  ];
  const STREETS = ['Main St', 'High St', 'Broadway', 'Park Ave', 'Oak St', 'Pine St', 'Maple Ave', 'Cedar Ln', 'Washington St', 'Lakeview Dr'];
  const JOBS = ['Software Engineer', 'Teacher', 'Nurse', 'Sales Manager', 'Driver', 'Chef', 'Accountant', 'Designer', 'Electrician', 'Mechanic'];

  const generate = () => {
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const loc = CITIES[Math.floor(Math.random() * CITIES.length)];
    const streetNum = Math.floor(Math.random() * 9000) + 100;
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    
    // SSN format: AAA-GG-SSSS
    const ssn = `${Math.floor(Math.random() * 899) + 100}-${Math.floor(Math.random() * 89) + 10}-${Math.floor(Math.random() * 8999) + 1000}`;
    
    // Phone
    const phone = `(${Math.floor(Math.random() * 800) + 200}) ${Math.floor(Math.random() * 800) + 200}-${Math.floor(Math.random() * 8999) + 1000}`;
    
    // DOB
    const start = new Date(1960, 0, 1);
    const end = new Date(2003, 0, 1);
    const dob = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

    setProfile({
      fullName: `${fn} ${ln}`,
      firstName: fn,
      lastName: ln,
      address: `${streetNum} ${street}`,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      ssn,
      phone,
      dob: dob.toISOString().split('T')[0],
      job: JOBS[Math.floor(Math.random() * JOBS.length)],
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${Math.floor(Math.random()*99)}@gmail.com`
    });
  };

  useEffect(() => { generate(); }, []);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><User className="text-neon-cyan" /> Fake Identity Generator</h2>
        <button 
          onClick={generate}
          className="px-4 py-2 bg-neon-cyan hover:bg-cyan-400 text-black font-bold rounded-lg flex items-center gap-2 transition-colors"
        >
          <RefreshCw size={18} /> Regenerate
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ID Card */}
        <div className="bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <User size={120} />
           </div>
           
           <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-4 border-b border-dark-700 pb-4">
                 <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center text-2xl font-bold text-gray-400">
                    {profile.firstName[0]}{profile.lastName[0]}
                 </div>
                 <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Full Name</p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white">{profile.fullName}</h3>
                      <button onClick={() => copy(profile.fullName, 'name')} className="text-gray-500 hover:text-white">
                        {copiedField === 'name' ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                      </button>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <InfoItem icon={Calendar} label="Date of Birth" value={profile.dob} onCopy={() => copy(profile.dob, 'dob')} copied={copiedField === 'dob'} />
                 <InfoItem icon={Hash} label="SSN (Social Security)" value={profile.ssn} onCopy={() => copy(profile.ssn, 'ssn')} copied={copiedField === 'ssn'} highlight />
                 <InfoItem icon={Briefcase} label="Occupation" value={profile.job} onCopy={() => copy(profile.job, 'job')} copied={copiedField === 'job'} />
                 <InfoItem icon={Phone} label="Phone Number" value={profile.phone} onCopy={() => copy(profile.phone, 'phone')} copied={copiedField === 'phone'} />
              </div>
           </div>
        </div>

        {/* Address & Extra */}
        <div className="space-y-6">
           <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4 text-neon-purple">
                 <MapPin size={20} />
                 <h3 className="font-bold uppercase text-sm">Location Details</h3>
              </div>
              <div className="space-y-4">
                 <InfoItem label="Street Address" value={profile.address} onCopy={() => copy(profile.address, 'addr')} copied={copiedField === 'addr'} />
                 <div className="grid grid-cols-2 gap-4">
                    <InfoItem label="City" value={profile.city} onCopy={() => copy(profile.city, 'city')} copied={copiedField === 'city'} />
                    <InfoItem label="State" value={profile.state} onCopy={() => copy(profile.state, 'state')} copied={copiedField === 'state'} />
                 </div>
                 <InfoItem label="Zip Code" value={profile.zip} onCopy={() => copy(profile.zip, 'zip')} copied={copiedField === 'zip'} />
              </div>
           </div>

           <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
              <InfoItem label="Email Address" value={profile.email} onCopy={() => copy(profile.email, 'email')} copied={copiedField === 'email'} />
           </div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value, onCopy, copied, highlight }: any) => (
  <div className="group">
    <p className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
       {Icon && <Icon size={12} />} {label}
    </p>
    <div className={`flex items-center justify-between p-2 rounded-lg border ${highlight ? 'bg-red-500/10 border-red-500/30' : 'bg-dark-900 border-dark-700 group-hover:border-gray-500'} transition-colors`}>
       <span className={`font-mono text-sm ${highlight ? 'text-red-300' : 'text-gray-200'}`}>{value}</span>
       <button onClick={onCopy} className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
       </button>
    </div>
  </div>
);

export default FakeIdentity;
