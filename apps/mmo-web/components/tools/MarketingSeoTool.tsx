import React, { useMemo, useState } from 'react';
import { Megaphone, Link as LinkIcon, Copy, Check, PenLine } from 'lucide-react';
import { useI18n } from '../i18n';

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const MarketingSeoTool = () => {
  const { t } = useI18n();
  const [baseUrl, setBaseUrl] = useState('https://example.com');
  const [source, setSource] = useState('newsletter');
  const [medium, setMedium] = useState('email');
  const [campaign, setCampaign] = useState('launch');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Amazing Product');
  const [description, setDescription] = useState('Short description used in search results.');
  const [siteName, setSiteName] = useState('AT Tools');
  const [slugInput, setSlugInput] = useState('');
  const [copied, setCopied] = useState(false);

  const utmUrl = useMemo(() => {
    if (!baseUrl) return '';
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('utm_source', source);
      url.searchParams.set('utm_medium', medium);
      url.searchParams.set('utm_campaign', campaign);
      if (term) url.searchParams.set('utm_term', term);
      if (content) url.searchParams.set('utm_content', content);
      return url.toString();
    } catch {
      return '';
    }
  }, [baseUrl, source, medium, campaign, term, content]);

  const copy = () => {
    navigator.clipboard.writeText(utmUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Megaphone className="text-orange-400" /> {t('Marketing & SEO', 'Marketing & SEO')}
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
            <LinkIcon size={16} /> {t('UTM Builder', 'Tạo UTM')}
          </h3>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('Base URL', 'URL gốc')}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          />
          <div className="grid grid-cols-2 gap-2">
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="utm_source" className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200" />
            <input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="utm_medium" className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200" />
            <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="utm_campaign" className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="utm_term" className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200" />
            <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="utm_content" className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200 col-span-2" />
          </div>
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs text-orange-300 break-all">
            {utmUrl || t('Invalid URL', 'URL không hợp lệ')}
          </div>
          <button
            onClick={copy}
            disabled={!utmUrl}
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {t('Copy URL', 'Sao chép URL')}
          </button>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
            <PenLine size={16} /> {t('Slugify', 'Slugify')}
          </h3>
          <input
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder={t('Enter title to slugify', 'Nhập tiêu đề để slugify')}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          />
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs text-orange-300 break-all">
            {slugify(slugInput) || '-'}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400">{t('Meta Preview', 'Xem trước meta')}</h3>
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div className="space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Title', 'Tiêu đề')} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Description', 'Mô tả')} className="w-full h-24 bg-dark-900 border border-dark-700 rounded-lg p-3 text-gray-200" />
            <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder={t('Site name', 'Tên site')} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200" />
          </div>
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
            <div className="text-xs text-gray-500">{utmUrl || baseUrl}</div>
            <div className="text-lg font-bold text-orange-300 mt-1">{title}</div>
            <div className="text-sm text-gray-400 mt-2">{description}</div>
            <div className="text-xs text-gray-500 mt-3">{siteName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingSeoTool;
