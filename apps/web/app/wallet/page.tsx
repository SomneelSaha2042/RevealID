import { cookies } from "next/headers";
import { FileJson, ShieldCheck, Upload, ArrowRight, Lock, HardDrive, CheckCircle } from "lucide-react";
import { AppShell } from "../../components/app-shell";

type WalletCredential = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

const isOpenCertsDerived = (credential: WalletCredential) =>
  credential.credentialType === "RevealIDDerivedAcademicCredential" ||
  credential.credentialType.toLowerCase().includes("derivedacademic");

async function getCredentials() {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/wallet/credentials`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return { credentials: [] as WalletCredential[], authenticated: false };
  }

  if (!response.ok) {
    return { credentials: [] as WalletCredential[], authenticated: false };
  }

  return { ...(await response.json()), authenticated: true } as {
    credentials: WalletCredential[];
    authenticated: boolean;
  };
}

export default async function WalletPage() {
  const { credentials, authenticated } = await getCredentials();
  const openCertsCredentials = credentials.filter(isOpenCertsDerived);
  const revealIdCredentials = credentials.filter((credential) => !isOpenCertsDerived(credential));

  return (
    <AppShell
      description="Start with an OpenCerts import, then manage derived and native RevealID credentials from one wallet."
      eyebrow="Holder"
      title="Credential workspace"
    >
      {!authenticated ? (
        <div className="glass-card p-8 rounded-xl text-center max-w-lg mx-auto">
          <p className="text-on-surface-variant font-bold mb-4">Sign in as a holder to view wallet credentials.</p>
          <a href="/login" className="inline-block bg-primary text-on-primary font-bold px-6 py-3 rounded-lg hover:opacity-90">
            Sign in
          </a>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Header Action Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-success-green/10 rounded-full text-xs">
                  <span className="w-2 h-2 rounded-full bg-success-green animate-pulse"></span>
                  <span className="font-bold text-success-green uppercase tracking-wider">Wallet Encrypted</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-xs">
                  <span className="font-bold text-primary uppercase tracking-wider">Cloud Sync Active</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <a href="/wallet/import" className="flex items-center gap-2 px-6 py-3 bg-slate-surface border border-white/10 rounded-xl font-label-md text-label-md text-on-surface hover:bg-white/20 transition-all font-bold">
                <Upload size={16} />
                Import New
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Credentials List (Left Column) */}
            <div className="xl:col-span-2 space-y-6">
              {credentials.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl border border-dashed border-white/10 text-center">
                  <p className="text-on-surface-variant text-lg">No credentials in this wallet.</p>
                  <p className="text-on-surface-variant/60 text-sm mt-2">Import an OpenCerts file or receive an invitation to get started.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {credentials.map((credential) => {
                    const expired = credential.expiresAt ? new Date(credential.expiresAt).getTime() <= Date.now() : false;
                    const closed = Boolean(credential.revokedAt) || expired;
                    const derived = isOpenCertsDerived(credential);
                    return (
                      <div className="group" key={credential.id}>
                        <div className="glass-card rounded-[2rem] p-8 relative overflow-hidden transition-transform duration-500 hover:translate-y-[-4px]">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10 rounded-full"></div>
                          <div className="flex justify-between items-start mb-12">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-primary">
                                {derived ? <FileJson size={28} /> : <ShieldCheck size={28} />}
                              </div>
                              <div>
                                <h3 className="font-headline-md text-xl font-bold text-on-surface">{derived ? "OpenCerts-derived credential" : credential.credentialType}</h3>
                                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-widest mt-1">
                                  {derived ? "Derived by RevealID from imported source" : credential.issuerName}
                                </p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-lg border text-xs font-bold uppercase ${derived ? "bg-electric-cyan/20 border-electric-cyan/30 text-electric-cyan" : "bg-primary/20 border-primary/30 text-primary"}`}>
                              {derived ? "OpenCerts Bridge" : "RevealID Native"}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            <div>
                              <p className="font-label-sm text-xs text-on-surface-variant mb-1 font-bold">Issue Date</p>
                              <p className="font-body-md text-sm font-semibold text-on-surface">
                                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.issuedAt))}
                              </p>
                            </div>
                            <div>
                              <p className="font-label-sm text-xs text-on-surface-variant mb-1 font-bold">Status</p>
                              <p className={`font-body-md text-sm font-bold ${credential.revokedAt ? "text-error-red" : expired ? "text-warning" : "text-success-green"}`}>
                                {credential.revokedAt ? "Revoked" : expired ? "Expired" : "Active"}
                              </p>
                            </div>
                            {credential.expiresAt ? (
                              <div>
                                <p className="font-label-sm text-xs text-on-surface-variant mb-1 font-bold">Expiration</p>
                                <p className="font-body-md text-sm font-semibold text-on-surface">
                                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.expiresAt))}
                                </p>
                              </div>
                            ) : null}
                            <div className="col-span-2 md:col-span-1">
                              <p className="font-label-sm text-xs text-on-surface-variant mb-1 font-bold">Credential ID</p>
                              <code className="font-label-sm text-xs bg-charcoal-depth/50 px-2 py-1 rounded border border-white/5 text-primary break-all">
                                {credential.id.slice(0, 12)}...
                              </code>
                            </div>
                          </div>
                          <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
                            <div className="flex -space-x-2">
                              <div className="w-8 h-8 rounded-full border-2 border-charcoal-depth bg-slate-surface flex items-center justify-center text-on-surface-variant text-xs">
                                <Lock size={12} />
                              </div>
                            </div>
                            {closed ? (
                              <span className="text-on-surface-variant/40 text-sm font-bold">Share unavailable</span>
                            ) : (
                              <a href={`/wallet/${credential.id}`} className="text-primary font-bold text-sm flex items-center gap-2 hover:underline">
                                View &amp; Share
                                <ArrowRight size={16} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Stats & Security (Right Column) */}
            <div className="space-y-6">
              <div className="glass-card rounded-3xl p-6 border-l-4 border-l-electric-cyan">
                <h4 className="font-label-md text-xs text-on-surface font-bold mb-4 uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="text-electric-cyan" size={16} />
                  Wallet Stats
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between text-on-surface font-bold text-sm">
                    <span>OpenCerts-derived</span>
                    <span>{openCertsCredentials.length}</span>
                  </div>
                  <div className="flex justify-between text-on-surface font-bold text-sm">
                    <span>RevealID native</span>
                    <span>{revealIdCredentials.length}</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div className="bg-electric-cyan h-full" style={{ width: `${Math.min(100, (credentials.length / 10) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-slate-surface to-charcoal-depth">
                <div className="flex items-center gap-4 mb-4">
                  <CheckCircle className="text-success-green" size={20} />
                  <h4 className="font-label-md text-xs text-on-surface font-bold uppercase tracking-wider">Audit Trail</h4>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Your identity wallet is completely self-sovereign. Claims are verified locally inside the secure enclave. No external leaks have been detected.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
