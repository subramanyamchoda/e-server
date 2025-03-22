const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

// ✅ Initialize Express & Server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(express.json());
app.use(cors());

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000, // Wait 15s before throwing timeout
    socketTimeoutMS: 45000, // Prevent socket disconnections
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose Connection Error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB Disconnected. Reconnecting...");
});



// ✅ Order Schema
const orderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  cart: [
    {
      name: String,
      img: String,
      price: Number,
      quantity: Number,
    },
  ],
  totalPrice: Number,
  status: { type: String, default: "Pending" }, // Order Status
  date: { type: Date, default: Date.now }, // Removed auto-delete
});

const Order = mongoose.model("Order", orderSchema);

// ✅ Store Connected Users
const userSockets = {};

// ✅ Socket.IO Connection
io.on("connection", (socket) => {
  console.log("⚡ A user connected:", socket.id);

  socket.on("register", (email) => {
    userSockets[email] = socket.id;
    console.log(`🔗 User Registered: ${email} - Socket ID: ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log("⚡ A user disconnected");
  });
});

// ✅ Nodemailer Email Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Function to Send Order Email (Customer & Admin)
const sendOrderEmail = async (order) => {
  const emailContent = `
    <h2>Order Confirmation</h2>
    <p>Dear ${order.name},</p>
    <p>Thank you for your order! Your order will be delivered within 1 day.</p>
    <h3>Order Details:</h3>
    <ul>${order.cart
      .map(
        (item) =>
          `<li>${item.name} - Qty: ${item.quantity} - Price: $${item.price * item.quantity}</li>`
      )
      .join("")}</ul>
    <p><strong>Total Price: $${order.totalPrice}</strong></p>
    <p>Delivery Address: ${order.street}, ${order.city}</p>
  `;

  try {
    // ✅ Send Email to Customer
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.email,
      subject: "Order Confirmation - Your Order is Placed!",
      html: emailContent,
    });

    console.log("✅ Order email sent to customer!");

    // ✅ Send Email to Admin
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "New Order Received",
      html: `<h2>New Order Placed</h2>
             <p>Customer Name: ${order.name}</p>
             <p>Email: ${order.email}</p>
             <p>Phone: ${order.phone}</p>
             <h3>Order Details:</h3>
             <ul>${order.cart
               .map(
                 (item) =>
                   `<li>${item.name} - Qty: ${item.quantity} - Price: $${item.price * item.quantity}</li>`
               )
               .join("")}</ul>
             <p><strong>Total Price: $${order.totalPrice}</strong></p>
             <p>Delivery Address: ${order.street}, ${order.city}</p>`,
    });

    console.log("✅ Order email sent to admin!");

    // ✅ Emit real-time notification to Admin
    io.emit("newOrder", {
      title: "New Order Received",
      message: `A new order has been placed by ${order.name} - Total: $${order.totalPrice}`,
    });

    // ✅ Emit real-time notification to Customer
    if (userSockets[order.email]) {
      io.to(userSockets[order.email]).emit("orderSuccess", {
        title: "Order Placed",
        message: `Your order has been placed successfully! Estimated delivery: 1 day. 🚚`,
      });
    }

  } catch (error) {
    console.error("❌ Error sending order email:", error);
  }
};

// ✅ Order API - Create Order
app.post("/api/orders", async (req, res) => {
  try {
    console.log("📦 New Order Received:", req.body);

    if (!req.body.email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const order = new Order(req.body);
    await order.save();

    // ✅ Send email notification
    await sendOrderEmail(order);

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("❌ Error saving order:", error);
    res.status(500).json({ message: "Error saving order", error: error.message });
  }
});

// ✅ Get All Orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

// ✅ Update Order Status
app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log(`🚀 Order Status Updated: ${order.email} - ${status}`);

    // ✅ Emit real-time notification to Customer
    if (userSockets[order.email]) {
      io.to(userSockets[order.email]).emit("orderUpdate", {
        title: "Order Update",
        message: `Your order status has been updated to: ${status}. 🎉`,
      });
    }

    res.json({ message: "Order status updated", order });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ message: "Error updating order status", error: error.message });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
