import { AdminLiveDashboard } from '@/components/admin/live-dashboard/AdminLiveDashboard';
import { LiveOperationsMapCard } from '@/components/operations/LiveOperationsMapCard';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <LiveOperationsMapCard mode="admin" />
      <AdminLiveDashboard />
    </div>
  );
}
