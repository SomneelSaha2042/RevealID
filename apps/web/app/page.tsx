import { ArrowRight, FileJson, KeyRound, LockKeyhole, ShieldCheck, Upload, Wallet, Share2 } from "lucide-react";
import { AuthNav } from "./auth/AuthNav";
import { BrandMark } from "../components/brand-mark";
import { ButtonLink } from "../components/ui/button";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

async function getHealth() {
  try {
    const response = await fetch(`${apiBase}/health`, { cache: "no-store" });
    return response.ok ? "API reachable" : "API unavailable";
  } catch {
    return "API unavailable";
  }
}

export default async function Home() {
  const health = await getHealth();
  const isHealthy = health === "API reachable";

  return (
    <main className="min-h-screen bg-background text-on-background font-body-md overflow-x-hidden selection:bg-primary selection:text-on-primary-container">
      {/* TopNavBar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-container-max mx-auto px-grid-margin flex items-center justify-between min-h-16 py-2 md:py-0 h-auto md:h-16 flex-wrap md:flex-nowrap gap-4">
          <div className="flex items-center gap-8 shrink-0">
            <a className="brand-lockup font-headline-md text-headline-md font-bold text-primary" href="/" aria-label="RevealID home">
              <BrandMark />
            </a>
          </div>
          <AuthNav />
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative min-h-[819px] flex items-center overflow-hidden">
          {/* Animated Background Placeholder */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/50 to-background"></div>
          </div>
          <div className="relative z-10 max-w-container-max mx-auto px-grid-margin w-full">
            <div className="max-w-3xl">
              <p className="text-primary font-label-md tracking-widest uppercase mb-4">OpenCerts Bridge &amp; Selective Disclosure</p>
              <h1 className="font-display-xl text-display-xl mb-6 leading-[1.1] text-white">
                Turn an OpenCerts file into a <span className="text-primary">private sharing</span> credential.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-2xl">
                RevealID verifies a holder-provided OpenCerts source, derives a wallet credential, and lets the holder share only selected academic claims with a verifier.
              </p>
              <div className="flex flex-wrap gap-4">
                <ButtonLink href="/wallet/import" className="px-8 py-4 rounded-xl font-bold flex items-center gap-2 glow-hover transition-all bg-primary text-on-primary hover:opacity-90">
                  <Upload aria-hidden="true" size={20} />
                  Import OpenCerts
                </ButtonLink>
                <ButtonLink href="/wallet" variant="secondary" className="border border-white/20 bg-white/5 hover:bg-white/10 px-8 py-4 rounded-xl font-bold flex items-center gap-2 transition-all text-white">
                  Open wallet
                  <ArrowRight aria-hidden="true" size={20} />
                </ButtonLink>
              </div>
              <div className="mt-8 flex items-center gap-2 text-on-surface-variant font-label-sm">
                <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-success-green" : "bg-error-red"} animate-pulse`} />
                {health}
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section (Bento Inspired) */}
        <section className="py-24 bg-charcoal-depth relative">
          <div className="max-w-container-max mx-auto px-grid-margin">
            <div className="mb-16">
              <h2 className="font-headline-lg text-headline-lg text-white mb-4">Bridge Workflow</h2>
              <p className="text-on-surface-variant">Source file to selective share</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="glass-card p-8 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
                  <ShieldCheck aria-hidden="true" size={80} />
                </div>
                <div className="w-12 h-12 rounded-full step-gradient flex items-center justify-center text-on-primary font-bold text-xl mb-6">1</div>
                <h3 className="font-headline-md text-headline-md text-white mb-3">Verify OpenCerts</h3>
                <p className="text-on-surface-variant">Check source integrity before normalization and cryptographic derivation.</p>
              </div>
              {/* Step 2 */}
              <div className="glass-card p-8 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
                  <Wallet aria-hidden="true" size={80} />
                </div>
                <div className="w-12 h-12 rounded-full step-gradient flex items-center justify-center text-on-primary font-bold text-xl mb-6">2</div>
                <h3 className="font-headline-md text-headline-md text-white mb-3">Derive RevealID credential</h3>
                <p className="text-on-surface-variant">Store a holder-bound SD-JWT credential with provenance and secure linkage.</p>
              </div>
              {/* Step 3 */}
              <div className="glass-card p-8 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
                  <Share2 aria-hidden="true" size={80} />
                </div>
                <div className="w-12 h-12 rounded-full step-gradient flex items-center justify-center text-on-primary font-bold text-xl mb-6">3</div>
                <h3 className="font-headline-md text-headline-md text-white mb-3">Share selected claims</h3>
                <p className="text-on-surface-variant">Verifier sees disclosed fields only, maintaining total user data sovereignty.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values / Data Viz Section */}
        <section className="py-24">
          <div className="max-w-container-max mx-auto px-grid-margin">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-white mb-12">Security First Architecture</h2>
                <div className="space-y-6">
                  {/* Value 1 */}
                  <div className="flex gap-6 p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors bg-surface-container-low">
                    <div className="shrink-0 text-primary">
                      <ShieldCheck aria-hidden="true" size={36} />
                    </div>
                    <div>
                      <h4 className="font-headline-md text-headline-md text-white mb-2">OpenCerts source first</h4>
                      <p className="text-on-surface-variant">Import starts from a JSON OpenCerts file and records source hash, checks, and provenance for absolute chain of custody.</p>
                    </div>
                  </div>
                  {/* Value 2 */}
                  <div className="flex gap-6 p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors bg-surface-container-low">
                    <div className="shrink-0 text-primary">
                      <KeyRound aria-hidden="true" size={36} />
                    </div>
                    <div>
                      <h4 className="font-headline-md text-headline-md text-white mb-2">RevealID credentials too</h4>
                      <p className="text-on-surface-variant">Native issuer-created credentials still live in the same encrypted wallet and share flow, unifying your identity stack.</p>
                    </div>
                  </div>
                  {/* Value 3 */}
                  <div className="flex gap-6 p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors bg-surface-container-low">
                    <div className="shrink-0 text-primary">
                      <LockKeyhole aria-hidden="true" size={36} />
                    </div>
                    <div>
                      <h4 className="font-headline-md text-headline-md text-white mb-2">Privacy by default</h4>
                      <p className="text-on-surface-variant">Hidden source fields, grades, transcript rows, and IDs stay out of verifier responses. Disclose only what is necessary.</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative Element */}
              <div className="relative">
                <div className="aspect-square glass-card rounded-[2rem] flex items-center justify-center p-12 overflow-hidden">
                  <img className="w-full h-full object-contain opacity-80 group-hover:scale-105 transition-transform duration-700" alt="Futuristic digital credential wallet representation" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxDLo438ewganOKHj_Qf4MJFgLcPAc9auUQ_EpSr7uyqHnDgxJoCPzddwTp-r3dakuGV3_oiD21SuokTEnHPbtUpJ5YT5hzlpNb8DuX5FD6mrTzaGIgvfjxoQSoHMP1UA5re9qSgO1HbX-ryQXb8SuSJ5YYC4GK9qOKIt9eTFeKJfrNaqpCmZpTmqNU8SKmTf8ioN-2c7tkL8DdnH7YOUKCTNb2g6YY0LMO2sXZtytjUHblWks0eAVOnp6HcW1AuxSdeMdbWjoqRE"/>
                  {/* Overlay UI elements */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-primary/20 rounded-full animate-[spin_20s_linear_infinite]"></div>
                    <div className="w-80 h-80 border border-primary/10 rounded-full animate-[spin_35s_linear_infinite_reverse]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Path Focus */}
        <section className="py-12 pb-24">
          <div className="max-w-container-max mx-auto px-grid-margin">
            <div className="bg-gradient-to-r from-surface-container-highest to-surface-container-low p-1 border-l-4 border-primary rounded-r-xl">
              <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="font-headline-md text-headline-md text-primary mb-2 flex items-center gap-2">
                    <FileJson aria-hidden="true" size={24} />
                    Demo path
                  </h3>
                  <p className="text-on-surface text-lg">Upload the public OpenCerts sample, derive a wallet credential, then share recipient, institution, course, or graduation date.</p>
                </div>
                <div className="flex gap-4">
                  <ButtonLink href="/register" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all">Register holder</ButtonLink>
                  <ButtonLink href="/wallet" className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold transition-all text-on-primary">Open wallet</ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-charcoal-depth border-t border-white/10">
        <div className="max-w-container-max mx-auto px-grid-margin py-stack-lg flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <BrandMark className="footer-brand-mark" />
            <p className="font-body-md text-body-md text-on-surface-variant">© 2024 RevealID. Secure Selective Disclosure.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Privacy Policy</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Terms of Service</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Documentation</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

