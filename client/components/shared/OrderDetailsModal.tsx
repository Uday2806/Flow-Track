
import React from 'react';
import { Order, Attachment } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { DownloadIcon, FileIcon } from '../icons/Icons';

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
  hideCustomerInfo?: boolean;
  hideDates?: boolean;
}

const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|svg)$/i.test(fileName);
};

const AttachmentItem: React.FC<{ attachment: Attachment }> = ({ attachment }) => (
    <div className="p-3 mb-2 border rounded-md bg-slate-50 space-y-3">
        {isImage(attachment.name) ? (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                <img src={attachment.url} alt={attachment.name} className="w-full h-auto rounded-md object-cover max-h-60 cursor-pointer" />
            </a>
        ) : (
            <div className="flex items-center text-slate-600 p-2">
                <FileIcon className="w-10 h-10 mr-4 text-slate-400 flex-shrink-0" />
                <p className="font-semibold text-sm truncate">{attachment.name}</p>
            </div>
        )}
        <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
                Uploaded by {attachment.uploadedBy} on {new Date(attachment.timestamp).toLocaleDateString()}
            </span>
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" download={attachment.name}>
                <Button variant="secondary" size="sm" className="flex items-center">
                    <DownloadIcon className="w-3.5 h-3.5 mr-1.5" />
                    Download
                </Button>
            </a>
        </div>
    </div>
);


const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, hideCustomerInfo, hideDates }) => {
  if (!order) return null;

  return (
    <Modal isOpen={!!order} onClose={onClose} title={`Order Details: ${order.shopifyOrderNumber || order.id}`} className="max-w-4xl">
      {/* Main content grid: 3/5 for info, 2/5 for notes */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">
        
        {/* Left Column */}
        <div className="md:col-span-3 space-y-6">
          
          {/* Order Information Section */}
          <div>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold">Order Information</h4>
              {order.shopifyOrderUrl && (
                <a href={order.shopifyOrderUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="link" size="sm">View on Shopify</Button>
                </a>
              )}
            </div>
            <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-2 text-slate-700">
              <p className="col-span-2 sm:col-span-1 break-words">
                <strong className="font-semibold text-slate-900">Product:</strong> {order.productName}
              </p>
              {!hideCustomerInfo && (
                <p className="col-span-2 sm:col-span-1 break-words">
                  <strong className="font-semibold text-slate-900">Customer:</strong> {order.customerName}
                </p>
              )}
              {!hideCustomerInfo && order.customerEmail && (
                 <p className="col-span-2 sm:col-span-1 break-words">
                  <strong className="font-semibold text-slate-900">Email:</strong> {order.customerEmail}
                </p>
              )}
              {!hideCustomerInfo && order.customerPhone && (
                 <p className="col-span-2 sm:col-span-1 break-words">
                  <strong className="font-semibold text-slate-900">Phone:</strong> {order.customerPhone}
                </p>
              )}
              <p className="col-span-2 sm:col-span-1">
                <strong className="font-semibold text-slate-900">Status:</strong> {order.status}
              </p>
              {order.financialStatus && (
                <p className="col-span-2 sm:col-span-1">
                  <strong className="font-semibold text-slate-900">Payment:</strong> {order.financialStatus}
                </p>
              )}
               <p className="col-span-2 sm:col-span-1">
                <strong className="font-semibold text-slate-900">Priority:</strong> {order.priority}
              </p>
              {order.shopifyOrderNumber && (
                <p className="col-span-2 sm:col-span-1">
                  <strong className="font-semibold text-slate-900">Shopify ID:</strong> {order.shopifyOrderNumber}
                </p>
              )}
               <p className="col-span-2 sm:col-span-1">
                <strong className="font-semibold text-slate-900">Internal ID:</strong> {order.id}
              </p>
              {!hideDates && (
                <p className="col-span-2 sm:col-span-1">
                  <strong className="font-semibold text-slate-900">Created:</strong> {new Date(order.createdAt).toLocaleString()}
                </p>
              )}
              {!hideDates && (
                <p className="col-span-2">
                  <strong className="font-semibold text-slate-900">Last Updated:</strong> {new Date(order.updatedAt).toLocaleString()}
                </p>
              )}
              {order.textUnderDesign && (
                <p className="col-span-2 pt-2 border-t mt-2">
                  <strong className="font-semibold text-slate-900 block">Text Under Design:</strong> 
                  <span className="text-slate-600">{order.textUnderDesign}</span>
                </p>
              )}
              {order.shippingAddress && (
                <p className="col-span-2 pt-2 border-t mt-2">
                  <strong className="font-semibold text-slate-900 block">Shipping Address:</strong> 
                  <span className="text-slate-600">{order.shippingAddress}</span>
                </p>
              )}
            </div>
          </div>
          
          {/* Associated Staff Section */}
          <div>
            <h4 className="font-semibold">Associated Staff</h4>
            {order.associatedUsers && order.associatedUsers.length > 0 ? (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-2 -mr-2">
                {order.associatedUsers.map(user => (
                  <div key={user.id} className="p-2 bg-slate-50 rounded-md border text-sm">
                    <p className="font-semibold text-slate-900">{user.name} <span className="text-xs font-medium text-slate-500">({user.role})</span></p>
                    <p className="text-slate-500">{user.email}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No staff have been associated with this order yet.</p>
            )}
          </div>


          {/* Attachments Section */}
          <div>
            <h4 className="font-semibold">Attachments</h4>
            {order.attachments.length > 0 ? (
              <div className="mt-2 max-h-60 overflow-y-auto pr-2 -mr-2">
                {order.attachments.map(att => <AttachmentItem key={att.id} attachment={att} />)}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No attachments found.</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="md:col-span-2">
          <h4 className="font-semibold">Notes / History</h4>
          {order.notes.length > 0 ? (
            <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-md max-h-[30rem] overflow-y-auto">
              {order.notes.map((note, index) => (
                <p key={index} className="border-b border-slate-200 last:border-b-0 py-2">{note}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 mt-2">No notes recorded.</p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;