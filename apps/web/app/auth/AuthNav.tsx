import { getCurrentUser } from "./session";
import { LogoutButton } from "./LogoutButton";
import { ButtonLink } from "../../components/ui/button";

export async function AuthNav() {
  const user = await getCurrentUser();

  return (
    <nav className="flex items-center gap-6">
      <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="/wallet/import">
        OpenCerts
      </a>
      <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="/wallet">
        Wallet
      </a>
      <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="/wallet/shares">
        Shares
      </a>
      <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="/issuer/issue">
        Issue
      </a>
      {user ? (
        <>
          <span className="font-label-md text-label-md text-white font-bold">{user.name}</span>
          <LogoutButton />
        </>
      ) : (
        <>
          <ButtonLink href="/login" variant="ghost" className="text-on-surface-variant hover:text-primary font-label-md text-label-md">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" variant="secondary" className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2 rounded-full font-bold hover:opacity-90 transition-opacity active:opacity-80">
            Register
          </ButtonLink>
        </>
      )}
    </nav>
  );
}
