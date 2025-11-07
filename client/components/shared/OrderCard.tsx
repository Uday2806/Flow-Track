
import React from 'react';
import { Order, OrderStatus, Priority } from '../../types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';

interface OrderCardProps {
  order: Order;
  onViewDetails: () => void;
  actions?: React.ReactNode;
  hideCustomerInfo?: boolean;
  hideDates?: boolean;
  hideStatus?: boolean;
  digitizerName?: string;
}

const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.AT_TEAM:
      return 'bg-blue-100 text-blue-800';
    case OrderStatus.AT_DIGITIZER:
      return 'bg-orange-100 text-orange-800';
    case OrderStatus.TEAM_REVIEW:
      return 'bg-yellow-100 text-yellow-800';
    case OrderStatus.AT_VENDOR:
      return 'bg-purple-100 text-purple-800';
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const getPriorityStyle = (priority: Priority) => {
    switch (priority) {
        case Priority.HIGH:
            return 'bg-red-100 text-red-800';
        case Priority.MEDIUM:
            return 'bg-yellow-100 text-yellow-800';
        case Priority.LOW:
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-slate-100 text-slate-800';
    }
};

const getFinancialStatusStyle = (status?: string) => {
    if (!status) return 'hidden';
    switch (status.toLowerCase()) {
        case 'paid':
            return 'bg-green-100 text-green-800';
        case 'partially paid':
            return 'bg-yellow-100 text-yellow-800';
        default:
            return 'bg-slate-100 text-slate-800';
    }
};

const OrderCard: React.FC<OrderCardProps> = ({ order, onViewDetails, actions, hideCustomerInfo, hideDates, hideStatus, digitizerName }) => {
  const formattedDate = new Date(order.updatedAt).toLocaleString();

  return (
    <Card className="flex flex-col h-full transition-shadow duration-300 hover:shadow-md">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <div className="flex items-center gap-2">
                    <CardTitle>{order.shopifyOrderNumber || order.id}</CardTitle>
                    {order.financialStatus && (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getFinancialStatusStyle(order.financialStatus)}`}>
                            {order.financialStatus}
                        </span>
                    )}
                </div>
                <CardDescription>{order.productName}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getPriorityStyle(order.priority)}`}>
                  {order.priority}
              </span>
              {!hideStatus && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                    {order.status}
                </span>
              )}
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-sm text-slate-600 space-y-1">
          {!hideCustomerInfo && <p><strong>Customer:</strong> {order.customerName}</p>}
          {!hideDates && <p><strong>Last Update:</strong> {formattedDate}</p>}
          {digitizerName && order.status === OrderStatus.TEAM_REVIEW && (
            <p className="pt-2 mt-2 border-t border-slate-200">
              <strong className="text-slate-800">From Digitizer:</strong> {digitizerName}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={onViewDetails}>
          View Details
        </Button>
        <div className="flex space-x-2">
            {actions}
        </div>
      </CardFooter>
    </Card>
  );
};

export default OrderCard;