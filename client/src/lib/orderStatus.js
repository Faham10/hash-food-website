export const ORDER_STATUSES = [
  'Pending',
  'Accepted',
  'Preparing',
  'Ready for Pickup',
  'Out for Delivery',
  'Delivered',
  'Served',
  'Completed',
  'Cancelled',
];

const ORDER_STATUS_FLOWS = {
  Delivery: ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Delivered'],
  'Pick-Up': ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup', 'Completed'],
  'Dine-In': ['Pending', 'Accepted', 'Preparing', 'Served', 'Completed'],
};

export function getOrderStatusFlow(orderType) {
  return ORDER_STATUS_FLOWS[orderType] || ORDER_STATUS_FLOWS.Delivery;
}

export function getAllowedOrderStatuses(orderType, status) {
  if (status === 'Cancelled') return [status];

  const flow = getOrderStatusFlow(orderType);
  const currentIndex = flow.indexOf(status);
  if (currentIndex < 0) return [status, 'Cancelled'];
  if (currentIndex === flow.length - 1) return [status];

  return [status, flow[currentIndex + 1], 'Cancelled'];
}

export function getStatusClass(status) {
  return status.toLowerCase().replaceAll(' ', '-');
}

export function isOrderComplete(status) {
  return status === 'Delivered' || status === 'Completed';
}
