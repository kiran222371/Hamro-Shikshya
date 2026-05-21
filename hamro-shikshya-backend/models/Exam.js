import mongoose from "mongoose";

const examMarkSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },

    studentName: {
      type: String,
      default: "",
      trim: true,
    },

    obtainedMarks: {
      type: Number,
      required: true,
      default: 0,
    },

    marksObtained: {
      type: Number,
      required: true,
      default: 0,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    teacherId: {
      type: String,
      default: "",
      trim: true,
    },

    schoolId: {
      type: String,
      default: "",
      trim: true,
    },

    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    classId: {
      type: String,
      required: true,
      trim: true,
    },

    className: {
      type: String,
      default: "",
      trim: true,
    },

    section: {
      type: String,
      default: "",
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    maxMarks: {
      type: Number,
      required: true,
    },

    schoolId: {
      type: String,
      default: "",
      trim: true,
    },

    teacherId: {
      type: String,
      default: "",
      trim: true,
    },

    marks: {
      type: [examMarkSchema],
      default: [],
    },
  },
  { timestamps: true }
);

examSchema.index({
  classId: 1,
  className: 1,
  section: 1,
  subject: 1,
});

const Exam = mongoose.model("Exam", examSchema);

export default Exam;