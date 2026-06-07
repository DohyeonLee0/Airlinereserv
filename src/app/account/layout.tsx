import CustomerAreaLayout from "@/app/components/customer/CustomerAreaLayout";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <CustomerAreaLayout>{children}</CustomerAreaLayout>;
}
