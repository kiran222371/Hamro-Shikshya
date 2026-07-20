import express from "express";
import Notice from "../models/Notice.js";

const router = express.Router();

// Create notice
router.post("/create", async (req, res) => {
  try {
    const { title, message, classId, createdBy } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    const notice = await Notice.create({
      title,
      message,
      classId: classId || "",
      createdBy: createdBy || "",
    });

    res.status(201).json(notice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all notices
router.get("/", async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    res.status(200).json(notices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get notices by class
router.get("/class/:classId", async (req, res) => {
  try {
    const notices = await Notice.find({
      classId: req.params.classId,
    }).sort({ createdAt: -1 });

    res.status(200).json(notices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;