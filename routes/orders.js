const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const sendOrderEmail = require("../utils/email");

// Place a new order
router.post("/", async (req, res) => {
  try {
    if (!req.body.email) return res.status(400).json({ message: "Email is required" });

    const order = new Order(req.body);
    await order.save();

    await sendOrderEmail(order);

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("❌ Error saving order:", error);
    res.status(500).json({ message: "Error saving order", error: error.message });
  }
});

// Get all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

// Update order status
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ message: "Order status updated", order });
  } catch (error) {
    res.status(500).json({ message: "Error updating order status", error: error.message });
  }
});

router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findById(orderId).populate("cart.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
