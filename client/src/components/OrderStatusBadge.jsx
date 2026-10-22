import { X } from 'lucide-react';
import { getStatusClass } from '../lib/orderStatus.js';

export default function OrderStatusBadge({ status, className = '' }) {
  return (
    <span className={`status-badge status-${getStatusClass(status)} ${className}`.trim()}>
      {status === 'Cancelled' && <X size={12} strokeWidth={2.5} aria-hidden="true" />}
      {status}
    </span>
  );
}
