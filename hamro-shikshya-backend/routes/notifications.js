import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = express.Router();

const cleanText = (value) => String(value ?? "").trim();

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided.",
      });
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id || decoded.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Logged-in user was not found.",
      });
    }

    if (user.isActive === false || user.accountStatus === "deactivated") {
      return res.status(403).json({
        success: false,
        message: "This account is deactivated.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};

router.use(protect);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const unreadOnly = String(req.query.unreadOnly || "").toLowerCase() === "true";

    const query = {
      recipientId: req.user._id,
      schoolId: req.user.schoolId,
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate("senderId", "name email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({
        recipientId: req.user._id,
        schoolId: req.user.schoolId,
        isRead: false,
      }),
    ]);

    return res.json({
      success: true,
      notifications,
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("Load notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load notifications.",
    });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipientId: req.user._id,
      schoolId: req.user.schoolId,
      isRead: false,
    });

    return res.json({
      success: true,
      unreadCount,
      count: unreadCount,
    });
  } catch (error) {
    console.error("Load unread count error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load unread notification count.",
    });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    const now = new Date();

    const result = await Notification.updateMany(
      {
        recipientId: req.user._id,
        schoolId: req.user.schoolId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    return res.json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read.",
    });
  }
});

router.patch("/:notificationId/read", async (req, res) => {
  try {
    const notificationId = cleanText(req.params.notificationId);

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipientId: req.user._id,
        schoolId: req.user.schoolId,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.json({
      success: true,
      notification,
      data: notification,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
    });
  }
});

router.delete("/:notificationId", async (req, res) => {
  try {
    const notificationId = cleanText(req.params.notificationId);

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipientId: req.user._id,
      schoolId: req.user.schoolId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.json({
      success: true,
      message: "Notification deleted.",
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete notification.",
    });
  }
});

export default router;
