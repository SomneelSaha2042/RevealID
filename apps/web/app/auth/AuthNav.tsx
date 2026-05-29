import { getCurrentUser } from "./session";
import { LogoutButton } from "./LogoutButton";

export async function AuthNav() {
  const user = await getCurrentUser();

  return (
    <nav>
      <a href="/wallet">Wallet</a>
      <a href="/wallet/shares">Shares</a>
      <a href="/issuer/issue">Issue</a>
      {user ? (
        <>
          <span className="nav-user">{user.name}</span>
          <LogoutButton />
        </>
      ) : (
        <>
          <a href="/login">Sign in</a>
          <a href="/register">Register</a>
        </>
      )}
    </nav>
  );
}
