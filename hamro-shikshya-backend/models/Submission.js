import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  answer: { type: String },
  submittedFileUrl: { type: String }, // optional file upload
  status: { type: String, enum: ["Submitted", "Pending"], default: "Submitted" },
  marks: { type: Number },
  feedback: { type: String },
  submittedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Submission", submissionSchema);