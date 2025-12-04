
import React, { useState } from 'react';
import { Order, Attachment, Role, Note } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { DownloadIcon, FileIcon, TrashIcon, EditIcon } from '../icons/Icons';
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

const NoteItem: React.FC<{ note: Note; canEdit: boolean; orderId: string }> = ({ note, canEdit, orderId }) => {
    const { editOrderNote, isLoading } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);

    const handleSave = async () => {
        if (editContent.trim() !== note.content) {
            await editOrderNote(orderId, note.id, editContent);
        }
        setIsEditing(false);
    }

    if (isEditing) {
        return (
            <div className="mb-3 p-3 bg-white border rounded shadow-sm">
                <textarea 
                    className="w-full text-sm border p-2 rounded mb-2 whitespace-pre-wrap" 
                    rows={4} 
                    value={editContent} 
                    onChange={e => setEditContent(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={isLoading}>Save</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="mb-4 flex flex-col space-y-1 group">
            <div className="flex justify-between items-baseline px-1">
                <span className="text-xs font-bold text-slate-700">
                    {note.authorName} 
                    {/* Only show role if it's Admin or System to differentiate from generic Team/Digitizer */}
                    {['Admin', 'System'].includes(note.authorRole) && <span className="font-normal text-slate-500 ml-1">({note.authorRole})</span>}
                </span>
                {canEdit && (
                    <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600">
                        <EditIcon className="w-3 h-3" />
                    </button>
                )}
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm relative">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                <p className="text-[10px] text-slate-400 mt-2 text-right">{new Date(note.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
        </div>
    );
};

const NoteColumn: React.FC<{ title: string; notes: Note[]; bgColor: string; canEditRole: boolean; orderId: string }> = ({ title, notes, bgColor, canEditRole, orderId }) => (
    <div className={`rounded-md p-3 h-full flex flex-col ${bgColor}`}>
        <h5 className="font-semibold text-slate-700 mb-3 text-center border-b pb-2 sticky top-0">{title}</h5>
        <div className="flex-grow overflow-y-auto max-h-[300px] pr-1 scrollbar-thin scrollbar-thumb-slate-300">
            {notes.length > 0 ? (
                notes.map((note, index) => (
                    // Handle legacy string notes if any exist
                    typeof note === 'string' ? (
                        <div key={index} className="mb-2 p-2 bg-white border rounded text-sm text-slate-600">
                            {note}
                        </div>
                    ) : (
                        <NoteItem key={note.id || index} note={note} canEdit={canEditRole && (note.authorRole === 'Team' || note.authorRole === 'Admin')} orderId={orderId} />
                    )
                ))
            ) : (
                <p className="text-sm text-slate-400 text-center italic mt-4">No notes.</p>
            )}
        </div>
    </div>
);


const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order: initialOrder, onClose, hideCustomerInfo, hideDates, hideAssociatedStaff }) => {
  // Added 'users' to destructuring
  const { orders, users, currentUser, deleteAttachment, isLoading } = useAppContext();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);

  // Use the latest order data from context if available, otherwise fallback to initial props
  // This ensures the modal updates immediately when attachments are deleted or status changes.
  const order = orders.find(o => o.id === initialOrder?.id) || initialOrder;

  if (!order) return null;
  
  const products = order.productName ? order.productName.split(', ') : [];
  
  // Find associated user objects for the assigned digitizer/vendor
  const assignedDigitizer = users.find(u => u.id === order.digitizerId);
  const assignedVendor = users.find(u => u.id === order.vendorId);

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

  // Helper to categorize notes
  const getNoteCategory = (note: Note | string): 'Team' | 'Digitizer' | 'Vendor' => {
      if (typeof note === 'string') {
          const lower = note.toLowerCase();
          if (lower.includes('digitizer')) return 'Digitizer';
          if (lower.includes('vendor') || lower.includes('approved')) return 'Vendor';
          return 'Team';
      }
      
      // If explicit target is set (new functionality)
      if (note.targetRole === 'Digitizer') return 'Digitizer';
      if (note.targetRole === 'Vendor') return 'Vendor';
      if (note.targetRole === 'Team') return 'Team';
      
      // Fallback for notes without targetRole
      if (note.authorRole === 'Digitizer') return 'Digitizer';
      if (note.authorRole === 'Vendor') return 'Vendor';
      
      // Fallback text matching for older structured notes
      const content = note.content.toLowerCase();
      if (content.includes('sent to digitizer') || content.includes('team rejected')) return 'Digitizer';
      if (content.includes('sent to vendor')) return 'Vendor';
      
      return 'Team';
  };

  const teamNotes = order.notes.filter(n => getNoteCategory(n) === 'Team');
  const digitizerNotes = order.notes.filter(n => getNoteCategory(n) === 'Digitizer');
  const vendorNotes = order.notes.filter(n => getNoteCategory(n) === 'Vendor');

  const canEditTeamNotes = currentUser?.role === Role.TEAM || currentUser?.role === Role.ADMIN;

  return (
    <>
        <Modal isOpen={!!order} onClose={onClose} title={`Order Details: ${order.shopifyOrderNumber || order.id}`} className="max-w-6xl">
            <div className="space-y-6">
                
                {/* Top Section: Order Info and Attachments */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {/* Info Column */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-lg">Order Information</h4>
                            {order.shopifyOrderUrl && (
                                <a href={order.shopifyOrderUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="link" size="sm">View on Shopify</Button>
                                </a>
                            )}
                        </div>
                        <div className="text-sm grid grid-cols-2 gap-x-6 gap-y-3 text-slate-700 bg-white p-4 rounded border">
                            <div className="col-span-2">
                                <strong className="font-semibold text-slate-900 block mb-1">Products:</strong> 
                                <ul className="list-disc list-inside bg-slate-50 p-2 rounded border border-slate-100">
                                    {products.map((p, i) => (
                                        <li key={i} className="py-0.5">{p}</li>
                                    ))}
                                </ul>
                            </div>
                            
                            {!hideCustomerInfo && (
                                <>
                                    <p><strong className="font-semibold text-slate-900">Customer:</strong> {order.customerName}</p>
                                    {order.customerEmail && <p><strong className="font-semibold text-slate-900">Email:</strong> {order.customerEmail}</p>}
                                    {order.customerPhone && <p><strong className="font-semibold text-slate-900">Phone:</strong> {order.customerPhone}</p>}
                                </>
                            )}
                            
                            <p><strong className="font-semibold text-slate-900">Status:</strong> {order.status}</p>
                            {order.financialStatus && <p><strong className="font-semibold text-slate-900">Payment:</strong> {order.financialStatus}</p>}
                            <p><strong className="font-semibold text-slate-900">Priority:</strong> {order.priority}</p>
                            {order.shopifyOrderNumber && <p><strong className="font-semibold text-slate-900">Shopify ID:</strong> {order.shopifyOrderNumber}</p>}
                            <p><strong className="font-semibold text-slate-900">Internal ID:</strong> {order.id}</p>
                            
                            {!hideDates && (
                                <>
                                    <p><strong className="font-semibold text-slate-900">Created:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                                    <p><strong className="font-semibold text-slate-900">Last Updated:</strong> {new Date(order.updatedAt).toLocaleString()}</p>
                                </>
                            )}

                            {(order.textUnderDesign || order.shippingAddress) && (
                                <div className="col-span-2 pt-2 border-t mt-1 space-y-2">
                                     {order.textUnderDesign && (
                                        <p>
                                            <strong className="font-semibold text-slate-900 block">Text Under Design:</strong> 
                                            <span className="text-slate-600">{order.textUnderDesign}</span>
                                        </p>
                                    )}
                                    {order.shippingAddress && (
                                        <p>
                                            <strong className="font-semibold text-slate-900 block">Shipping Address:</strong> 
                                            <span className="text-slate-600">{order.shippingAddress}</span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Associated Staff Section */}
                        {!hideAssociatedStaff && (
                            <div>
                                <h4 className="font-semibold mb-2">Associated Staff</h4>
                                {order.associatedUsers && order.associatedUsers.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                    {order.associatedUsers.map(user => (
                                        <div key={user.id} className="p-2 bg-slate-50 rounded-md border text-xs">
                                            <span className="font-semibold text-slate-900 block">{user.name}</span>
                                            <span className="text-xs text-slate-500 block mb-1">{user.email}</span>
                                            <span className="text-slate-500 font-medium">{user.role}</span>
                                        </div>
                                    ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">No staff associated.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Attachments Column */}
                    <div>
                        <h4 className="font-semibold mb-2">Attachments</h4>
                        <div className="bg-slate-50 rounded border p-2 h-full max-h-[500px] overflow-y-auto">
                            {order.attachments.length > 0 ? (
                                order.attachments.map(att => (
                                    <AttachmentItem 
                                        key={att.id} 
                                        attachment={att} 
                                        onDelete={handleDeleteClick}
                                        canDelete={canDeleteAttachment(att)}
                                    />
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center mt-10">No attachments found.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Notes in 3 Columns */}
                <div>
                    <h4 className="font-semibold mb-3">Notes & History</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                        <NoteColumn 
                            title="Internal / Team" 
                            notes={teamNotes as Note[]} 
                            bgColor="bg-slate-100" 
                            canEditRole={canEditTeamNotes} 
                            orderId={order.id} 
                        />
                        <NoteColumn 
                            title={assignedDigitizer ? `${assignedDigitizer.name}` : "Digitizer"} 
                            notes={digitizerNotes as Note[]} 
                            bgColor="bg-orange-50" 
                            canEditRole={canEditTeamNotes} 
                            orderId={order.id} 
                        />
                        <NoteColumn 
                            title={assignedVendor ? `${assignedVendor.name}` : "Vendor"} 
                            notes={vendorNotes as Note[]} 
                            bgColor="bg-purple-50" 
                            canEditRole={canEditTeamNotes} 
                            orderId={order.id} 
                        />
                    </div>
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
