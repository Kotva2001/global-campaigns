import { Card } from "@/components/ui/card";

export const Placeholder = ({ title }: { title: string }) => (
  <div className="flex min-h-[80vh] items-center justify-center px-6">
    <Card className="border-border bg-card p-12 text-center">
      <div className="text-2xl font-bold">{title}</div>
      <div className="mt-2 text-sm text-muted-foreground">coming soon</div>
    </Card>
  </div>
);

export const Creators = () => <Placeholder title="Creators" />;
export const Analytics = () => <Placeholder title="Analytics" />;
export const Alerts = () => <Placeholder title="Alerts" />;
export const Scanner = () => <Placeholder title="Scanner" />;
