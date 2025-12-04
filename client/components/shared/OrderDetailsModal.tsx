
import React, { useState } from 'react';
import { Order, Attachment, Role } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { DownloadIcon, FileIcon, TrashIcon } from '../icons/Icons';
import { useAppContext } from '../../store/AppContext';

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
  hideCustomerInfo?: boolean;
  hideDates?: boolean;
  hideAssociatedStaff?: boolean;
}

const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fileName);
};

const AttachmentItem: React.FC<{ 
    attachment: Attachment; 
    onDelete?: (attachment: Attachment) => void;
    canDelete: boolean;
}> = ({ attachment, onDelete, canDelete }) => {
    const { addToast } = useAppContext();
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (isDownloading) return;

        try {
            setIsDownloading(true);
            const token = localStorage.getItem('flowtrack_token');
            
            // Fetch the file through our server proxy
            const response = await fetch(`/api/upload/download?url=${encodeURIComponent(attachment.url)}&filename=${encodeURIComponent(attachment.name)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Download failed');
            }

            // Create a blob from the stream
            const blob = await response.blob();
            
            // Create a temporary link to trigger the browser's download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = attachment.name;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            addToast({ type: 'success', message: 'Download started' });

        } catch (error) {
            console.error('Download error:', error);
            addToast({ type: 'error', message: 'Failed to download file. Please try again.' });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="p-3 mb-2 border rounded-md bg-slate-50 space-y-3">
            {isImage(attachment.name) ? (
                <div className="cursor-pointer" onClick={() => window.open(attachment.url, '_blank')}>
                    <img src={attachment.url} alt={attachment.name} className="w-full h-auto rounded-md object-cover max-h-60" />
                </div>
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
                <div className="flex gap-2">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex items-center"
                        onClick={handleDownload}
                        disabled={isDownloading}
                    >
                        <DownloadIcon className="w-3.5 h-3.5 mr-1.5" />
                        {isDownloading ? 'Downloading...' : 'Download'}
                    </Button>
                    {canDelete && onDelete && (
                        <Button 
                            variant="destructive" 
                            size="sm"
                            className="flex items-center px-2"
                            onClick={() => onDelete(attachment)}
                            title="Delete Attachment"
                        >
                            <TrashIcon className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};


const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order: initialOrder, onClose, hideCustomerInfo, hideDates, hideAssociatedStaff }) => {
  const { orders, currentUser, deleteAttachment, isLoading } = useAppContext();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);

  // Use the latest order data from context if available, otherwise fallback to initial props
  // This ensures the modal updates immediately when attachments are deleted or status changes.
  const order = orders.find(o => o.id === initialOrder?.id) || initialOrder;

  if (!order) return null;
  
  const products = order.productName ? order.productName.split(', ') : [];

  const canDeleteAttachment = (attachment: Attachment) => {
      // Team and Admin can delete attachments, but ONLY if they are not from Shopify.
      const isPrivilegedUser = currentUser?.role === Role.TEAM || currentUser?.role === Role.ADMIN;
      return isPrivilegedUser && !attachment.fromShopify;
  };

  const handleDeleteClick = (attachment: Attachment) => {
      setAttachmentToDelete(attachment);
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (attachmentToDelete && order) {
          await deleteAttachment(order.id, attachmentToDelete.id);
          setIsDeleteModalOpen(false);
          setAttachmentToDelete(null);
      }
  };

  return (
    <>
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
                <div className="col-span-2 mb-2">
                    <strong className="font-semibold text-slate-900 block mb-1">Products:</strong> 
                    <ul className="list-disc list-inside bg-slate-50 p-2 rounded border border-slate-100">
                        {products.map((p, i) => (
                            <li key={i} className="py-0.5">{p}</li>
                        ))}
                    </ul>
                </div>
                
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
            {!hideAssociatedStaff && (
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
            )}


            {/* Attachments Section */}
            <div>
                <h4 className="font-semibold">Attachments</h4>
                {order.attachments.length > 0 ? (
                <div className="mt-2 max-h-60 overflow-y-auto pr-2 -mr-2">
                    {order.attachments.map(att => (
                        <AttachmentItem 
                            key={att.id} 
                            attachment={att} 
                            onDelete={handleDeleteClick}
                            canDelete={canDeleteAttachment(att)}
                        />
                    ))}
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

        <Modal 
            isOpen={isDeleteModalOpen} 
            onClose={() => setIsDeleteModalOpen(false)} 
            title="Confirm Deletion"
            footer={
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={confirmDelete} disabled={isLoading}>
                        {isLoading ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            }
        >
            <p>Are you sure you want to delete the attachment <strong>{attachmentToDelete?.name}</strong>?</p>
            <p className="text-sm text-slate-600 mt-2">This action cannot be undone.</p>
        </Modal>
    </>
  );
};

export default OrderDetailsModal;
