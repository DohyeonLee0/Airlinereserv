import CustomerAreaLayout from "@/app/components/customer/CustomerAreaLayout";

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return <CustomerAreaLayout>{children}</CustomerAreaLayout>;
}
