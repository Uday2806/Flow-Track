
export enum Role {
  SALES = 'Sales',
  TEAM = 'Team',
  ADMIN = 'Admin',
  DIGITIZER = 'Digitizer',
  VENDOR = 'Vendor',
}

export enum OrderStatus {
  AT_TEAM = 'At Team',
  AT_DIGITIZER = 'At Digitizer',
  TEAM_REVIEW = 'Team Review',
  AT_VENDOR = 'At Vendor',
  OUT_FOR_DELIVERY = 'Out for Delivery',
}

export enum Priority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  uploadedBy: Role;
  timestamp: string;
  fromShopify?: boolean;
}

export interface AssociatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Order {
  id: string;
  customerName: string;
  productName: string;
  status: OrderStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  notes: string[];
  digitizerId?: string;
  vendorId?: string;
  associatedUsers?: AssociatedUser[];
  // Shopify Integration Fields
  shopifyOrderId?: string;
  shopifyOrderUrl?: string;
  shopifyOrderNumber?: string;
  customerEmail?: string;
  customerPhone?: string;
  textUnderDesign?: string;
  shippingAddress?: string;
  financialStatus?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}
