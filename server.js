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

    const messages = await Message.find(searchQuery)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit);

    const totalMessages = await Message.countDocuments(searchQuery);
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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
