import { LaunchLens } from "@/components/lens/LaunchLens";
import { WalletProvider } from "@/wallet/WalletContext";

export const metadata = { title: "LaunchLens · Launchcraft" };

export default async function LaunchPage({ params }: { params: Promise<{ pool: string }> }) {
  const { pool } = await params;
  return (
    <WalletProvider>
      <LaunchLens poolAddress={pool} />
    </WalletProvider>
  );
}
