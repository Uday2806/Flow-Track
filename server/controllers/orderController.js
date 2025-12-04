
import Order from '../models/Order.js';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// Helper to generate next order ID
const getNextOrderId = async () => {
  const lastOrder = await Order.findOne().sort({ createdAt: -1 });
  if (!lastOrder) return 'ORD-001';
  const lastIdNum = parseInt(lastOrder.id.split('-')[1]);
  return `ORD-${(lastIdNum + 1).toString().padStart(3, '0')}`;
};

// Helper function to upload a file buffer to Cloudinary
const streamUpload = (fileBuffer, fileName) => {
    const isPdf = fileName && fileName.toLowerCase().endsWith('.pdf');
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { 
              folder: 'flowtrack',
              resource_type: isPdf ? 'raw' : 'auto' // Force 'raw' for PDFs to prevent image processing/header issues
            },
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

export const getAllOrders = async (req, res) => {    
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders", error: error.message });
    }
};

export const syncShopifyOrders = async (req, res) => {
  // Helper to robustly extract URLs from any string and add them as attachments
  const extractAndAddAttachments = (text, sourceName, attachments, foundUrls, timestamp) => {
    if (!text || typeof text !== 'string') return;

    const urlRegex = /(https?:\/\/[^\s'"]+)/g;
    const matches = text.match(urlRegex);

    if (matches) {
      matches.forEach(url => {
        if (!foundUrls.has(url)) {
          let fileName = 'Attachment';
          try {
            const urlObject = new URL(url);
            const pathParts = urlObject.pathname.split('/');
            const decodedFileName = decodeURIComponent(pathParts[pathParts.length - 1]);
            if (decodedFileName) {
              fileName = decodedFileName;
            }
          } catch (e) {
            // Fallback for URLs that can't be parsed
            fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || sourceName;
          }

          attachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: fileName,
            url: url,
            uploadedBy: 'Sales', // Defaulting to Sales for Shopify sync
            timestamp: timestamp,
            fromShopify: true
          });
          foundUrls.add(url);
        }
      });
    }
  };

  // Helper to format Shopify shipping address into a readable string
  const formatShippingAddress = (addr) => {
    if (!addr) return 'No shipping address provided.';
    const addressParts = [
        addr.name,
        addr.company,
        addr.address1,
        addr.address2,
        `${addr.city || ''} ${addr.province_code || addr.province || ''} ${addr.zip || ''}`.trim(),
        addr.country
    ].filter(Boolean); // Filter out any null, undefined, or empty strings
    return addressParts.join(', ');
  };
  
  // Helper to format financial status for display
  const formatFinancialStatus = (status) => {
    if (!status) return null;
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  try {
    const { SHOPIFY_API_PASSWORD, SHOPIFY_STORE_URL } = process.env;
    if (!SHOPIFY_API_PASSWORD || !SHOPIFY_STORE_URL) {
      return res.status(400).json({ message: "Shopify Admin API Access Token and Store URL are not configured on the server." });
    }
    
    const config = {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_API_PASSWORD,
        'Content-Type': 'application/json'
      }
    };
    
    let allShopifyOrders = [];
    let nextUrl = `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json?status=open&limit=250`;

    // Paginate through all open orders
    while (nextUrl) {
      const response = await axios.get(nextUrl, config);
      const ordersFromPage = response.data.orders;

      if (ordersFromPage && ordersFromPage.length > 0) {
        allShopifyOrders.push(...ordersFromPage);
      }

      const linkHeader = response.headers.link;
      const nextLink = linkHeader?.split(',').find(s => s.includes('rel="next"'));

      if (nextLink) {
        nextUrl = nextLink.match(/<(.*?)>/)[1];
      } else {
        nextUrl = null; // No more pages, exit loop
      }
    }

    const shopifyOrders = allShopifyOrders;

    if (!shopifyOrders || shopifyOrders.length === 0) {
      return res.status(200).json({ message: 'No new open orders to import.', importedOrders: [] });
    }

    const existingShopifyIds = await Order.find({
      shopifyOrderId: { $in: shopifyOrders.map(o => o.id.toString()) }
    }).select('shopifyOrderId');

    const existingIdsSet = new Set(existingShopifyIds.map(o => o.shopifyOrderId));
    const newShopifyOrders = shopifyOrders.filter(o => !existingIdsSet.has(o.id.toString()));

    if (newShopifyOrders.length === 0) {
      return res.status(200).json({ message: 'All recent orders are already in FlowTrack.', importedOrders: [] });
    }
    
    const importedOrders = [];

    for (const shopifyOrder of newShopifyOrders) {
      const attachments = [];
      const foundUrls = new Set();
      const orderTimestamp = new Date(shopifyOrder.created_at);
      let textUnderDesignValue = '';

      // 1. Check top-level order note
      extractAndAddAttachments(shopifyOrder.note, 'Order Note', attachments, foundUrls, orderTimestamp);

      // 2. Check order-level note attributes for attachment links
      if (shopifyOrder.note_attributes) {
        shopifyOrder.note_attributes.forEach(prop => {
          extractAndAddAttachments(prop.value, prop.name, attachments, foundUrls, orderTimestamp);
        });
      }

      // 3. Check line-item-level properties for attachments and custom text
      if (shopifyOrder.line_items) {
        shopifyOrder.line_items.forEach(item => {
          if (item.properties) {
            item.properties.forEach(prop => {
              extractAndAddAttachments(prop.value, prop.name, attachments, foundUrls, orderTimestamp);
              
              if (prop.name.toLowerCase().trim().startsWith('text under design') && prop.value) {
                 textUnderDesignValue += (textUnderDesignValue ? ', ' : '') + prop.value;
              }
            });
          }
        });
      }
      
      const newOrder = new Order({
        id: await getNextOrderId(),
        customerName: `${shopifyOrder.customer?.first_name || ''} ${shopifyOrder.customer?.last_name || ''}`.trim() || 'Guest Customer',
        productName: shopifyOrder.line_items.map(item => `${item.quantity} x ${item.name}`).join(', '),
        status: 'At Team',
        attachments: attachments,
        notes: [
          `Imported from Shopify. Order #${shopifyOrder.order_number}`,
          'Order automatically assigned to Team for processing.'
        ],
        associatedUsers: [],
        shopifyOrderId: shopifyOrder.id.toString(),
        shopifyOrderUrl: `https://${SHOPIFY_STORE_URL}/admin/orders/${shopifyOrder.id}`,
        shopifyOrderNumber: `#${shopifyOrder.order_number}`,
        customerEmail: shopifyOrder.customer?.email || null,
        customerPhone: shopifyOrder.customer?.phone || null,
        textUnderDesign: textUnderDesignValue || null,
        shippingAddress: formatShippingAddress(shopifyOrder.shipping_address),
        financialStatus: formatFinancialStatus(shopifyOrder.financial_status),
      });
      
      const savedOrder = await newOrder.save();
      importedOrders.push(savedOrder);
    }
    
    res.status(201).json({ 
        message: `Successfully imported ${importedOrders.length} new orders.`, 
        importedOrders 
    });

  } catch (error) {
    const isAxiosError = !!error.isAxiosError;
    const errorMessage = isAxiosError && error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('Shopify Sync Error:', error.code || '', errorMessage);

    if (error.code === 'ENOTFOUND') {
        return res.status(500).json({ message: `Could not connect to Shopify. Please ensure the store URL '${process.env.SHOPIFY_STORE_URL}' is correct and does not include 'https://'.` });
    }
    if (isAxiosError && error.response?.status === 401) {
        return res.status(401).json({ message: 'Shopify authentication failed. Please check your Admin API Access Token.' });
    }
    if (isAxiosError && error.response?.status === 403) {
        return res.status(403).json({ message: 'Shopify API access forbidden. Please check your app\'s permissions (API scopes) in Shopify.' });
    }

    res.status(500).json({ message: 'An unexpected error occurred while syncing with Shopify.', error: errorMessage });
  }
};


export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status: newStatus, note, digitizerId, vendorId, uploadedBy, priority } = req.body;
        const user = req.user; // from 'protect' middleware
        
        const order = await Order.findOne({ id });
        if (!order) return res.status(404).json({ message: "Order not found" });

        const currentStatus = order.status;

        // Allow update if status changes OR if reassigning digitizer while 'At Digitizer'
        const isReassigningDigitizer = currentStatus === 'At Digitizer' && newStatus === 'At Digitizer' && digitizerId && digitizerId !== order.digitizerId;
        
        if (currentStatus === newStatus && !isReassigningDigitizer) {
            return res.status(409).json({ message: "This action cannot be completed because the order is already in this state. Please refresh the page." });
        }

        const transitions = {
            'At Digitizer': ['At Team', 'Team Review'],
            'Team Review': ['At Digitizer'],
            'At Vendor': ['Team Review'],
            'Out for Delivery': ['At Vendor']
        };

        const allowedPreviousStatuses = transitions[newStatus];
        if (allowedPreviousStatuses) {
            if (newStatus === 'At Digitizer') {
                // If reassigning, current status is allowed to be 'At Digitizer'
                if (isReassigningDigitizer) {
                    // Logic allows pass-through
                } else {
                    const expectedPreviousStatus = (note && note.startsWith('Team rejected:')) ? 'Team Review' : 'At Team';
                    if (currentStatus !== expectedPreviousStatus) {
                         return res.status(409).json({ message: "This action cannot be completed because the order's status was updated by someone else. Please refresh the page." });
                    }
                }
            } else if (!allowedPreviousStatuses.includes(currentStatus)) {
                return res.status(409).json({ message: "This action cannot be completed because the order's status was updated by someone else. Please refresh the page." });
            }
        }

        // Add acting user to associated users list if not already there.
        const isAlreadyAssociated = order.associatedUsers.some(u => u.id === user.id);
        if (!isAlreadyAssociated) {
            order.associatedUsers.push({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            });
        }
        
        // Handle file uploads if they exist.
        if (req.files && req.files.length > 0) {
            try {
                for (const file of req.files) {
                    const uploadResult = await streamUpload(file.buffer, file.originalname);
                    const newAttachment = {
                        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        name: file.originalname,
                        url: uploadResult.secure_url,
                        uploadedBy: uploadedBy, // Sent from client FormData
                        timestamp: new Date().toISOString(),
                        fromShopify: false
                    };
                    order.attachments.push(newAttachment);
                }
            } catch (uploadError) {
                console.error('Cloudinary Upload Error:', uploadError);
                return res.status(500).json({ message: 'File upload failed during status update.' });
            }
        }
        
        // Update the order fields
        order.status = newStatus;
        if (digitizerId !== undefined) order.digitizerId = digitizerId;
        if (vendorId !== undefined) order.vendorId = vendorId;
        if (priority) order.priority = priority;
        if (note) order.notes.push(`${user.role} (${user.name}): ${note}`);
        
        const updatedOrder = await order.save();
        res.status(200).json(updatedOrder);

    } catch (error) {
        res.status(500).json({ message: "Error updating order status", error: error.message });
    }
};

export const addOrderNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const user = req.user;

        if (!note) {
            return res.status(400).json({ message: "Note content is required." });
        }

        const order = await Order.findOne({ id });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        order.notes.push(`${user.role} (${user.name}): ${note}`);
        
        // Add user to associated users if they are not already
        const isAlreadyAssociated = order.associatedUsers.some(u => u.id === user.id);
        if (!isAlreadyAssociated) {
            order.associatedUsers.push({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            });
        }

        const updatedOrder = await order.save();
        res.status(200).json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: "Error adding note to order", error: error.message });
    }
};

export const deleteOrderAttachment = async (req, res) => {
    try {
        const { id, attachmentId } = req.params;
        const order = await Order.findOne({ id });
        if (!order) return res.status(404).json({ message: "Order not found" });

        const attachment = order.attachments.find(a => a.id === attachmentId);
        if (!attachment) return res.status(404).json({ message: "Attachment not found" });

        if (attachment.fromShopify) {
            return res.status(403).json({ message: "Cannot delete attachments fetched from Shopify." });
        }

        order.attachments = order.attachments.filter(a => a.id !== attachmentId);
        await order.save();
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: "Error deleting attachment", error: error.message });
    }
};

// Utility to seed database with initial mock data
export const seedOrders = async (req, res) => {
    try {
        await Order.deleteMany({}); // Clear existing orders
        res.status(200).send('Orders collection has been cleared. Use Shopify Sync to import real orders.');
    } catch (error) {
        res.status(500).json({ message: "Error clearing orders collection", error: error.message });
    }
}
