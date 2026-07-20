import express from "express";
import Submission from "../models/Submission.js";

const router = express.Router();

// Submit homework
router.post("/submit", async (req, res) => {
  const { studentId, taskId, answer, submittedFileUrl } = req.body;
  try {
    const submission = await Submission.create({ studentId, taskId, answer, submittedFileUrl });
    res.status(201).json(submission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get submissions for a student
router.get("/student/:studentId", async (req, res) => {
  try {
    const submissions = await Submission.find({ studentId: req.params.studentId });
    res.status(200).json(submissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get submissions for a task (for teacher review)
router.get("/task/:taskId", async (req, res) => {
  try {
    const submissions = await Submission.find({ taskId: req.params.taskId });
    res.status(200).json(submissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;