const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const sendOrderEmail = async (order) => {
  try {
    const emailContent = `
      <h2>Order Confirmation</h2>
      <p>Dear ${order.name},</p>
      <p>Thank you for your order! Your order will be delivered within 1 day.</p>
      <h3>Order Details:</h3>
      <ul>${order.cart.map((item) => `<li>${item.name} - Qty: ${item.quantity} - Price: $${item.price * item.quantity}</li>`).join("")}</ul>
      <p><strong>Total Price: $${order.totalPrice}</strong></p>
      <p>Delivery Address: ${order.street}, ${order.city}</p>
    `;

    await transporter.sendMail({ from: process.env.EMAIL_USER, to: order.email, subject: "Order Confirmation", html: emailContent });
  } catch (error) {
    console.error("❌ Error sending order email:", error);
  }
};

module.exports = sendOrderEmail;
