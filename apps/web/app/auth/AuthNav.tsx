import { getCurrentUser } from "./session";
import { LogoutButton } from "./LogoutButton";
import { ButtonLink } from "../../components/ui/button";

export async function AuthNav() {
  const user = await getCurrentUser();

  return (
    <nav>
      <a href="/wallet">Wallet</a>
      <a href="/wallet/import">Import</a>
      <a href="/wallet/shares">Shares</a>
      <a href="/issuer/issue">Issue</a>
      {user ? (
        <>
          <span className="nav-user">{user.name}</span>
          <LogoutButton />
        </>
      ) : (
        <>
          <ButtonLink href="/login" variant="ghost">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" variant="secondary">
            Register
          </ButtonLink>
        </>
      )}
    </nav>
  );
}
