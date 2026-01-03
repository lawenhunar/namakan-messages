const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Message Schema
const messageSchema = new mongoose.Schema({
  receiverName: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  backgroundColor: {
    type: String,
    default: "#ffffff",
    trim: true,
  },
  textColor: {
    type: String,
    default: "#6b4423",
    trim: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model("Message", messageSchema);

// Set EJS as the template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple authentication middleware for admin routes
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === adminUsername && password === adminPassword) {
    return next();
  } else {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
}

// Routes
app.get("/", (req, res) => {
  res.render("home", {
    title: "نامەکان - سەرەتا",
  });
});

app.get("/submit", (req, res) => {
  res.render("submit", {
    title: "نامەکان - نامە بنێرە",
  });
});

app.get("/about", (req, res) => {
  res.render("about", {
    title: "نامەکان - دەربارە",
  });
});

app.get("/all-messages", (req, res) => {
  res.render("all-messages", {
    title: "نامەکان - هەموو نامەکان",
  });
});

// Admin routes
app.get("/admin", requireAuth, (req, res) => {
  res.render("admin", {
    title: "نامەکان - بەڕێوبەرایەتی",
  });
});

// API endpoint to handle message submission
app.post("/api/messages", async (req, res) => {
  try {
    const { receiverName, content, backgroundColor, textColor } = req.body;

    // Validate input
    if (!receiverName || !content) {
      return res.status(400).json({
        success: false,
        message: "ناوی وەرگر و ناوەرۆکی نامە پێویستە",
      });
    }

    // Create new message
    const message = new Message({
      receiverName: receiverName.trim(),
      content: content.trim(),
      backgroundColor: backgroundColor || "#ffffff",
      textColor: textColor || "#6b4423",
    });

    // Save to database
    await message.save();

    res.status(201).json({
      success: true,
      message: "نامە بە سەرکەوتوویی نێردرا",
      data: message,
    });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({
      success: false,
      message: "هەڵەیەک روویدا لە ناردنی نامەدا",
    });
  }
});

// API endpoint to retrieve messages with pagination and search
app.get("/api/messages", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';

    const skip = (page - 1) * limit;

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        receiverName: search // Exact match search
      };
    }

    // Only show accepted messages to public
    const query = {
      status: 'accepted',
      ...searchQuery
    };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit);

    const totalMessages = await Message.countDocuments(query);
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      success: true,
      data: messages,
      currentPage: page,
      totalPages: totalPages,
      totalMessages: totalMessages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("Error retrieving messages:", error);
    res.status(500).json({
      success: false,
      message: "هەڵەیەک روویدا لە گەراندنەوەی نامەکاندا",
    });
  }
});

// Admin API endpoints
// Get all messages for admin (with all statuses)
app.get("/api/admin/messages", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status || 'all'; // 'all', 'pending', 'accepted', 'declined'

    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalMessages = await Message.countDocuments(query);
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      success: true,
      data: messages,
      currentPage: page,
      totalPages: totalPages,
      totalMessages: totalMessages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("Error retrieving admin messages:", error);
    res.status(500).json({
      success: false,
      message: "هەڵەیەک روویدا لە گەراندنەوەی نامەکاندا",
    });
  }
});

// Accept a message
app.post("/api/admin/messages/:id/accept", requireAuth, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { status: 'accepted' },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "نامە نەدۆزرایەوە",
      });
    }

    res.json({
      success: true,
      message: "نامە بە سەرکەوتوویی پەسەند کرا",
      data: message,
    });
  } catch (error) {
    console.error("Error accepting message:", error);
    res.status(500).json({
      success: false,
      message: "هەڵەیەک روویدا لە پەسەندکردنی نامەدا",
    });
  }
});

// Decline/Reject a message
app.post("/api/admin/messages/:id/reject", requireAuth, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "نامە نەدۆزرایەوە",
      });
    }

    res.json({
      success: true,
      message: "نامە بە سەرکەوتوویی ڕەت کرا",
      data: message,
    });
  } catch (error) {
    console.error("Error rejecting message:", error);
    res.status(500).json({
      success: false,
      message: "هەڵەیەک روویدا لە ڕەتکردنی نامەدا",
    });
  }
});

// Cleanup function for old rejected messages
async function cleanupOldRejectedMessages() {
  try {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const result = await Message.deleteMany({
      status: 'rejected',
      createdAt: { $lt: fiveDaysAgo }
    });

    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} old rejected messages`);
    }
  } catch (error) {
    console.error('Error cleaning up old rejected messages:', error);
  }
}

// Run cleanup every 24 hours
setInterval(cleanupOldRejectedMessages, 24 * 60 * 60 * 1000);

// Run cleanup on startup
cleanupOldRejectedMessages();

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
