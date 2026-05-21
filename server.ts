import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import fs from "fs";

dotenv.config();

// Supabase Configuration
const rawSupabaseUrl = process.env.SUPABASE_URL || "";
// Clean URL: Remove /rest/v1/ or trailing slashes if user provided them
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is missing. Database features will not work.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Use Service Role Key for server-side storage if available to bypass RLS policies
const supabaseStorageClient = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : supabase;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Config Multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

async function startServer() {
  // Server-side connection test
  try {
    const { data, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
    if (error) {
      console.warn("⚠️ Supabase connection test failed:", error.message);
    } else {
      console.log("✅ Supabase connected successfully!");
    }
  } catch (e) {
    console.error("❌ Supabase connection error:", e);
  }

  // --- API Routes ---

  // Connection Test Endpoint
  app.get("/api/db-test", async (req, res) => {
    try {
      const { data, error } = await supabase.from('products').select('id').limit(1);
      if (error) throw error;
      res.json({ status: "connected", message: "Supabase connection is working!", data });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // File Upload Route
  app.post("/api/upload", (req, res, next) => {
    try {
      const uploadFn = upload.single("image");
      uploadFn(req, res, (err) => {
        if (err) {
          console.error("❌ Multer storage/upload error:", err);
          return res.status(500).json({ error: "Multer upload failed", details: err.message || err });
        }
        next();
      });
    } catch (err: any) {
      console.error("❌ Multer execution exception:", err);
      res.status(500).json({ error: "Multer initialization failed", details: err.message || err });
    }
  }, async (req: any, res) => {
    try {
      if (!req.file) {
        console.warn("⚠️ No file received in /api/upload");
        return res.status(400).json({ error: "No file uploaded" });
      }

      // 1. Try to upload to Supabase Storage if configured
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const fileName = `${Date.now()}-${req.file.filename || req.file.originalname}`;
          
          const { data, error } = await supabaseStorageClient.storage
            .from("product-images")
            .upload(fileName, fileBuffer, {
              contentType: req.file.mimetype,
              upsert: true
            });

          if (!error) {
            const { data: publicUrlData } = supabaseStorageClient.storage
              .from("product-images")
              .getPublicUrl(fileName);
              
            if (publicUrlData && publicUrlData.publicUrl) {
              console.log("☁️ Successfully uploaded to Supabase Storage:", publicUrlData.publicUrl);
              
              // Clean up the local temp file after cloud upload succeeds
              try {
                fs.unlinkSync(req.file.path);
              } catch (e) {
                console.warn("⚠️ Failed to delete local temp file:", e);
              }
              
              return res.json({ imageUrl: publicUrlData.publicUrl });
            }
          } else {
            console.warn("⚠️ Supabase Storage upload failed, falling back to local file. Error:", error.message);
            if (error.message && error.message.includes("row-level security")) {
              console.warn("💡 TIP: To fix the row-level security error, you can either:\n" +
                "1. Add SUPABASE_SERVICE_ROLE_KEY to your environment variables to bypass RLS on the server.\n" +
                "2. Or go to Supabase Dashboard > Storage > product-images > Policies, and create an INSERT policy allowing 'public/anonymous' or authenticated uploads.");
            }
          }
        } catch (storageErr: any) {
          console.warn("⚠️ Error uploading to Supabase Storage bucket:", storageErr.message || storageErr);
        }
      }

      // 2. Fallback to local uploads path (works for local dev / non-serverless)
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log("✅ File uploaded locally:", imageUrl);
      res.json({ imageUrl });
    } catch (err: any) {
      console.error("🔥 Error during upload controller:", err);
      res.status(500).json({ error: err.message || "Failed to process uploaded file" });
    }
  });

  // Get all customers
  app.get("/api/customers", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, address, moo')
        .order('name', { ascending: true });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Add new customer
  app.post("/api/customers", async (req, res) => {
    const { name, phone, address, moo } = req.body;
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name, phone, address: address || '', moo: moo || '' }])
        .select();

      if (error) {
        console.error("❌ Supabase Customer Insert Error:", error.message);
        return res.status(403).json({ error: error.message });
      }
      
      const newCustomer = data && data[0];
      res.json({ success: true, id: newCustomer?.id });
    } catch (error: any) {
      console.error("🔥 Internal Server Error (Add Customer):", error);
      res.status(500).json({ error: error.message || "Failed to add customer" });
    }
  });

  // Update customer
  app.put("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, phone, address, moo } = req.body;
    try {
      const { error } = await supabase
        .from('customers')
        .update({ name, phone, address: address || '', moo: moo || '' })
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to update customer:", error);
      res.status(500).json({ error: error.message || "Failed to update customer" });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete customer:", error);
      res.status(500).json({ error: error.message || "Failed to delete customer" });
    }
  });

  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Add new product
  app.post("/api/products", async (req, res) => {
    const { name, price, stock, category, image } = req.body;
    try {
      console.log("📝 Attempting to insert product:", { name, price, stock, category });
      
      const { data, error } = await supabase
        .from('products')
        .insert([{ 
          name, 
          price: Number(price), 
          stock: Number(stock), 
          category, 
          image 
        }])
        .select();

      if (error) {
        console.error("❌ Supabase Insert Error:", error.message);
        return res.status(403).json({ 
          error: "Database Policy Error", 
          details: error.message,
          hint: "กรุณาตรวจสอบว่าได้ทำการ Disable RLS หรือตั้งค่า Policy ใน Supabase Dashboard แล้ว"
        });
      }
      
      const newProduct = data && data[0];
      console.log("✅ Product inserted successfully:", newProduct?.id);
      res.json({ success: true, id: newProduct?.id });
    } catch (error: any) {
      console.error("🔥 Internal Server Error (Add Product):", error);
      res.status(500).json({ error: error.message || "Failed to add product" });
    }
  });

  // Update product
  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { name, price, stock, category, image } = req.body;
    try {
      const { error } = await supabase
        .from('products')
        .update({ name, price, stock, category, image })
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Delete product
  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Cancel order and return stock
  app.patch("/api/orders/:id/cancel", async (req, res) => {
    const { id } = req.params;
    const { user } = req.body;

    try {
      // 1. Get the order details first to know what to return
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !order) throw new Error("Order not found");
      if (order.status === 'Cancelled') return res.status(400).json({ error: "Order is already cancelled" });

      // 2. Fetch order items from supabase order_items table
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', id);

      if (itemsError) throw itemsError;

      // 3. Update order status to Cancelled
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'Cancelled' })
        .eq('id', id);

      if (updateError) throw updateError;

      // 4. Return stock for each item
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const productId = item.product_id;
          const qty = item.quantity;

          if (productId) {
            // Increment stock
            const { data: p, error: pError } = await supabase
              .from('products')
              .select('stock')
              .eq('id', productId)
              .single();

            if (!pError && p) {
              await supabase.from('products').update({ stock: p.stock + qty }).eq('id', productId);
              
              // Log stock return
              try {
                await supabase.from('stock_history').insert([{
                  product_id: productId,
                  change: qty,
                  reason: `ยกเลิกบิล #${id}`,
                  operator: user || 'System'
                }]);
              } catch (logErr) {
                console.warn("Log error:", logErr);
              }
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Cancel order failed:", error);
      res.status(500).json({ error: error.message || "Failed to cancel order" });
    }
  });

  // Detailed stock update route
  app.patch("/api/products/:id/stock", async (req, res) => {
    const { id } = req.params;
    const { amount, reason, user } = req.body;
    try {
      console.log(`📦 Stock Update [PID: ${id}]: ${amount > 0 ? '+' : ''}${amount} by ${user || 'System'}. Reason: ${reason || 'N/A'}`);
      
      // First get current stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      const newStock = (product.stock || 0) + amount;

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', id);

      if (updateError) throw updateError;
      
      // Optional: Insert into a dedicated logs table if it exists
      // We'll try to insert and just catch error if table doesn't exist
      try {
        await supabase.from('stock_history').insert([{
          product_id: parseInt(id),
          change: amount,
          reason: reason || 'ปรับยอดทั่วไป',
          operator: user || 'Admin'
        }]);
      } catch (logErr) {
        console.warn("⚠️ Could not log to stock_history table (it might not exist):", logErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Stock update failed:", error);
      res.status(500).json({ error: "Failed to update stock" });
    }
  });

  // Example: Record a sale
  app.post("/api/orders", async (req, res) => {
    const { customerId, total, items, status } = req.body;
    try {
      // 1. Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ customer_id: customerId, total, status: status || 'Paid' }])
        .select();

      if (orderError) {
        console.error("❌ Supabase Order Error:", orderError.message);
        throw orderError;
      }

      const orderRow = orderData && orderData[0];
      const orderId = orderRow.id;

      // 2. Create order items and update stock
      for (const item of items) {
        // Insert order item
        const { error: itemError } = await supabase
          .from('order_items')
          .insert([{ 
            order_id: orderId, 
            product_id: item.product.id, 
            quantity: item.quantity, 
            price: item.product.price 
          }]);
        
        if (itemError) throw itemError;

        // Update product stock
        const { data: product, error: stockFetchError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product.id)
          .single();

        if (stockFetchError) throw stockFetchError;

        const { error: stockUpdateError } = await supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.product.id);

        if (stockUpdateError) throw stockUpdateError;
      }

      res.json({ success: true, orderId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Order process failed" });
    }
  });

  // Get all orders (Sales history)
  app.get("/api/orders", async (req, res) => {
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          status,
          created_at,
          customer:customer_id (name, phone)
        `)
        .order('id', { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return res.json([]);
      }

      // Fetch all order items and products for these orders
      const { data: allItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          price,
          product:product_id (name)
        `);

      if (itemsError) throw itemsError;

      // Map everything together
      const ordersWithItems = orders.map((order: any) => {
        const items = allItems
          .filter((item: any) => item.order_id === order.id)
          .map((item: any) => ({
            product: { name: item.product?.name || 'Unknown Product', price: item.price },
            quantity: item.quantity
          }));

        return {
          id: order.id.toString(),
          total: order.total,
          status: order.status,
          date: order.created_at,
          customer_name: order.customer?.name || 'ลูกค้าทั่วไป',
          customer_phone: order.customer?.phone || '-',
          items: items.map(it => ({
            name: it.product?.name || 'สินค้าลบไปแล้ว',
            price: it.product?.price || 0,
            quantity: it.quantity
          }))
        };
      });

      res.json(ordersWithItems);
    } catch (error) {
      console.error("Fetch orders error:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true, message: "Order status updated" });
    } catch (error) {
      console.error("Failed to update order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // --- Global Express Error Handler ---
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("🔥 Unhandled Express Error:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message || "Something went wrong on the server",
      details: err.stack || err
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
