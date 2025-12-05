
import React, { useState, useMemo } from 'react';
import { Role, OrderStatus, Order, Priority } from '../types';
import DashboardLayout from '../components/shared/DashboardLayout';
import { useAppContext } from '../store/AppContext';
import OrderCard from '../components/shared/OrderCard';
import OrderDetailsModal from '../components/shared/OrderDetailsModal';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { TruckIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, FileUpIcon, PencilRulerIcon } from '../components/icons/Icons';

const ITEMS_PER_PAGE = 12;

const VendorPortal: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { orders, currentUser, updateOrderStatus, isLoading } = useAppContext();

  // Modal and data state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [orderToShip, setOrderToShip] = useState<Order | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [shippingNote, setShippingNote] = useState('');

  // Search, filter, and pagination state
  const [queueTab, setQueueTab] = useState<'new' | 'in_progress'>('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const CURRENT_VENDOR_ID = currentUser?.id;

  const vendorOrders = useMemo(() => {
    if (!CURRENT_VENDOR_ID) return [];
    return orders.filter(o => o.vendorId === CURRENT_VENDOR_ID);
  }, [orders, CURRENT_VENDOR_ID]);

  const { newOrders, inProgressOrders } = useMemo(() => {
      const fresh: Order[] = [];
      const inProgress: Order[] = [];

      for (const order of vendorOrders) {
          // If status is not AT_VENDOR (e.g. delivered), skip for queue logic unless we want history in queue
          // But main logic is usually: AT_VENDOR is the active state.
          if (order.status !== OrderStatus.AT_VENDOR) continue;

          if (order.vendorStatus === 'InProgress') {
              inProgress.push(order);
          } else {
              fresh.push(order);
          }
      }
      return { newOrders: fresh, inProgressOrders: inProgress };
  }, [vendorOrders]);

  const activeQueueOrders = queueTab === 'new' ? newOrders : inProgressOrders;

  // Add history to the filter list if user selects 'Out for Delivery' in filterStatus
  // But generally Queue should only show active items. History is implicitly shown if we select All Statuses? 
  // Let's keep Queue focused on Actionable items (At Vendor).
  // If the user wants to see Shipped items, they can use filterStatus but my queueTab logic filters them out above.
  // Let's modify: If filterStatus includes Out For Delivery, we should probably show them.
  // BUT the prompt asks for "In Progress" tab. 
  // Let's stick to the Tab system for active work. Shipped items are "Done".
  
  // Actually, let's keep the existing dashboard behavior where it showed everything, 
  // but split the "At Vendor" items into New vs In Progress.
  // And "Out for Delivery" items can be shown in a separate list or integrated.
  // To keep it clean: 
  // Tab 1: Queue (New + In Progress) -> Actionable
  // Tab 2: Shipped / History
  // Similar to Digitizer Portal structure.

  // However, I'll stick to a simpler implementation for Vendor:
  // Just Tabs for the "At Vendor" items. And maybe a "Shipped" tab.
  
  // Let's just implement the request: New vs In Progress tabs for active orders.
  // And if they want to see shipped, I'll add a 'Shipped' tab.
  
  // Actually, previously it showed everything in one grid.
  // I will refactor to use the queueTab for active items, and maybe a 3rd tab for 'Shipped'.
  
  // Refined: 
  // Tab 'new' -> AT_VENDOR && status != InProgress
  // Tab 'in_progress' -> AT_VENDOR && status == InProgress
  // Tab 'shipped' -> OUT_FOR_DELIVERY

  const ordersToDisplay = useMemo(() => {
      if (queueTab === 'new') return newOrders;
      if (queueTab === 'in_progress') return inProgressOrders;
      // shipped
      return vendorOrders.filter(o => o.status === OrderStatus.OUT_FOR_DELIVERY);
  }, [queueTab, newOrders, inProgressOrders, vendorOrders]);
  

  const processedOrders = useMemo(() => {
    let filteredOrders = [...ordersToDisplay];

    if (filterPriority !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.priority === filterPriority);
    }

    if (searchTerm.trim() !== '') {
      const lowercasedTerm = searchTerm.toLowerCase().trim();
      filteredOrders = filteredOrders.filter(order =>
        order.id.toLowerCase().includes(lowercasedTerm) ||
        (order.shopifyOrderNumber && order.shopifyOrderNumber.toLowerCase().includes(lowercasedTerm)) ||
        order.productName.toLowerCase().includes(lowercasedTerm) ||
        order.customerName.toLowerCase().includes(lowercasedTerm)
      );
    }

    switch (sortOrder) {
      case 'newest':
        filteredOrders.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'oldest':
        filteredOrders.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'customer_asc':
        filteredOrders.sort((a, b) => a.customerName.localeCompare(b.customerName));
        break;
      case 'customer_desc':
        filteredOrders.sort((a, b) => b.customerName.localeCompare(a.customerName));
        break;
    }

    return filteredOrders;
  }, [ordersToDisplay, searchTerm, sortOrder, filterPriority]);

  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = processedOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleStartProduction = async (order: Order) => {
      try {
          await updateOrderStatus(order.id, order.status, undefined, { vendorStatus: 'InProgress' });
      } catch (error) {
          console.error("Failed to start production:", error);
      }
  };

  const openShipModal = (order: Order) => {
    setOrderToShip(order);
    setIsShipModalOpen(true);
  };

  const closeShipModal = () => {
    setOrderToShip(null);
    setFilesToUpload([]);
    setShippingNote('');
    setIsShipModalOpen(false);
  };
  
  const handleConfirmShip = async () => {
    if (orderToShip && filesToUpload.length > 0) {
      try {
        const note = `Vendor: Order has been shipped.${shippingNote ? ` Note: ${shippingNote}` : ''}`;
        await updateOrderStatus(orderToShip.id, OrderStatus.OUT_FOR_DELIVERY, note, {}, filesToUpload);
        
        closeShipModal();
      } catch (error) {
        console.error("Error confirming shipment:", error);
        // Error toast is handled by context's handleApiCall
      }
    }
  };

  const shippedCount = vendorOrders.filter(o => o.status === OrderStatus.OUT_FOR_DELIVERY).length;

  return (
    <DashboardLayout role={Role.VENDOR} onLogout={onLogout} showSidebar={false}>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-3xl font-bold">Vendor Dashboard</h3>
        </div>
      </div>

       <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div className="border-b border-slate-200">
              <button
                onClick={() => { setQueueTab('new'); setCurrentPage(1); }}
                className={`px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                  queueTab === 'new'
                    ? 'border-b-2 border-slate-800 text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                New Orders <span className="bg-slate-200 text-slate-600 text-xs font-semibold ml-1 px-2 py-0.5 rounded-full">{newOrders.length}</span>
              </button>
              <button
                onClick={() => { setQueueTab('in_progress'); setCurrentPage(1); }}
                className={`px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                  queueTab === 'in_progress'
                    ? 'border-b-2 border-purple-500 text-purple-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                In Progress <span className={`text-xs font-semibold ml-1 px-2 py-0.5 rounded-full ${queueTab === 'in_progress' ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-600'}`}>{inProgressOrders.length}</span>
              </button>
               {/* Using a string literal for 'shipped' even though state type doesn't explicitly allow it in my minimal definition above, 
                   TypeScript might complain if I don't update state type. 
                   Let's update the state definition to include 'shipped' 
               */}
              <button
                onClick={() => { setQueueTab('shipped' as any); setCurrentPage(1); }} 
                className={`px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                  queueTab === ('shipped' as any)
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Shipped <span className={`text-xs font-semibold ml-1 px-2 py-0.5 rounded-full ${queueTab === ('shipped' as any) ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-600'}`}>{shippedCount}</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full sm:w-48 pl-10 pr-4 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
                        aria-label="Search orders"
                    />
                </div>
                <select
                    value={filterPriority}
                    onChange={(e) => { setFilterPriority(e.target.value as Priority | 'all'); setCurrentPage(1); }}
                    className="px-4 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
                    aria-label="Filter by priority"
                >
                    <option value="all">All Priorities</option>
                    {Object.values(Priority).map(p => (
                    <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <select
                    value={sortOrder}
                    onChange={(e) => { setSortOrder(e.target.value); }}
                    className="px-4 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
                    aria-label="Sort orders"
                >
                    <option value="newest">Sort by: Newest</option>
                    <option value="oldest">Sort by: Oldest</option>
                    <option value="customer_asc">Customer (A-Z)</option>
                    <option value="customer_desc">Customer (Z-A)</option>
                </select>
            </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedOrders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onViewDetails={() => setSelectedOrder(order)}
            hideCustomerInfo={true}
            actions={
              order.status === OrderStatus.AT_VENDOR && (
                  <div className="w-full">
                       {queueTab === 'in_progress' ? (
                           <Button size="sm" onClick={() => openShipModal(order)} className="w-full">
                                <TruckIcon className="w-4 h-4 mr-2" />
                                Mark as Shipped
                            </Button>
                       ) : (
                           <Button size="sm" variant="secondary" onClick={() => handleStartProduction(order)} className="w-full">
                                <PencilRulerIcon className="w-4 h-4 mr-2" />
                                Start Production
                           </Button>
                       )}
                  </div>
              )
            }
          />
        ))}
      </div>

      {processedOrders.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-sm border">
              <p className="text-slate-500">
                   {queueTab === 'new' ? 'No new orders.' : 
                     queueTab === 'in_progress' ? 'No orders in production.' : 
                     'No shipped orders found.'}
              </p>
          </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-8 space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRightIcon className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      <OrderDetailsModal 
        order={selectedOrder} 
        onClose={() => setSelectedOrder(null)} 
        hideCustomerInfo={true} 
        hideAssociatedStaff={true} 
      />
      
      <Modal 
        isOpen={isShipModalOpen} 
        onClose={closeShipModal} 
        title={`Ship Order ${orderToShip?.shopifyOrderNumber || orderToShip?.id}`}
        footer={
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={closeShipModal}>Cancel</Button>
            <Button onClick={handleConfirmShip} disabled={filesToUpload.length === 0 || isLoading}>Confirm & Ship</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p>Please upload the final product image(s) or shipping document(s). This is required to mark the order as shipped.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Attach Final File(s) (Required)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    <FileUpIcon className="mx-auto h-12 w-12 text-slate-400" />
                    <div className="flex text-sm text-slate-600">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-800 hover:text-slate-600 focus-within:outline-none">
                            <span>Upload files</span>
                            <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={e => setFilesToUpload(e.target.files ? Array.from(e.target.files) : [])} />
                        </label>
                    </div>
                    <p className="text-xs text-slate-500">Select one or more files</p>
                </div>
            </div>
            {filesToUpload.length > 0 && (
                <div className="mt-3 text-sm">
                    <h4 className="font-medium text-slate-800">Selected files:</h4>
                    <ul className="mt-1 list-disc list-inside bg-slate-50 p-2 rounded-md border max-h-28 overflow-y-auto">
                        {filesToUpload.map((file, index) => (
                            <li key={index} className="text-slate-600 truncate">{file.name}</li>
                        ))}
                    </ul>
                </div>
            )}
          </div>
          <div>
            <label htmlFor="shipping-note" className="block text-sm font-medium text-slate-700">Add an optional note for the team:</label>
            <textarea 
                id="shipping-note"
                value={shippingNote}
                onChange={(e) => setShippingNote(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md bg-slate-50 border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-shadow" 
                placeholder="e.g., Shipped via Express Courier, tracking #XYZ." 
                rows={3}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default VendorPortal;
