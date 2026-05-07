import { Check, Crown, Download, LockKeyhole, Mic2, Sparkles } from "lucide-react";

const freeFeatures = ["Tonight's broadcast", "Limited archive", "Submit text confessions"];

const premiumFeatures = [
  "Full story archive",
  "Premium narrator voices",
  "Private confession vault",
  "Personal night story generator",
  "Download cinematic cards/audio",
  "Special stations"
];

const packs = [
  ["Rain City Pack", "Storm loops, streetlight cards, wet-window narrator tone"],
  ["Breakup Frequency Pack", "Unsent message prompts and soft-ache story drops"],
  ["Dream Transmission Pack", "Surreal midnight stories and sleepwalk visuals"],
  ["Ghost Motel Pack", "Neon rooms, strange calls, locked-door episodes"],
  ["Almost Tomorrow Pack", "Calmer endings, dawn cards, recovery-of-the-night playlists"]
];

export function Premium() {
  return (
    <section className="premium-screen">
      <div className="section-heading">
        <p className="eyebrow">Premium</p>
        <h1>Keep the station open longer</h1>
        <p>Realistic MVP monetization for atmospheric entertainment, private drafts, and special stations.</p>
      </div>

      <div className="pricing-grid">
        <article className="pricing-card">
          <div className="price-icon"><Mic2 size={22} /></div>
          <h2>Free</h2>
          <p className="price">$0</p>
          <ul>
            {freeFeatures.map((feature) => (
              <li key={feature}><Check size={16} />{feature}</li>
            ))}
          </ul>
          <button type="button" className="ghost-button">Current plan</button>
        </article>

        <article className="pricing-card pricing-card--featured">
          <div className="price-icon"><Crown size={22} /></div>
          <h2>Premium</h2>
          <p className="price">$6.99<span>/month</span></p>
          <ul>
            {premiumFeatures.map((feature) => (
              <li key={feature}><Check size={16} />{feature}</li>
            ))}
          </ul>
          <button type="button" className="primary-button">Start premium preview</button>
        </article>
      </div>

      <section className="packs-section">
        <div className="section-heading section-heading--small">
          <p className="eyebrow">One-time packs</p>
          <h2>Special transmissions</h2>
        </div>
        <div className="pack-grid">
          {packs.map(([title, description], index) => (
            <article key={title} className="pack-card">
              <span>{index % 2 === 0 ? <Sparkles size={18} /> : index === 3 ? <LockKeyhole size={18} /> : <Download size={18} />}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <button type="button" className="ghost-button">Preview pack</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
