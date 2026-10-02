import { CreateFlow } from "@/components/CreateFlow";
import { WalletProvider } from "@/wallet/WalletContext";

export const metadata = { title: "Create a launch" };

export default function CreatePage() {
  return (
    <WalletProvider>
      <CreateFlow />
    </WalletProvider>
  );
}
