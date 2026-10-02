import { LaunchesList } from "@/components/lens/LaunchesList";
import { WalletProvider } from "@/wallet/WalletContext";

export const metadata = { title: "My launches · Launchcraft" };

export default function LaunchesPage() {
  return (
    <WalletProvider>
      <LaunchesList />
    </WalletProvider>
  );
}
