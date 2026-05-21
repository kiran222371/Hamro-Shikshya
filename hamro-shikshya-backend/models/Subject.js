import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    subjectName: {
      type: String,
      trim: true,
      default: "",
    },

    subjectCode: {
      type: String,
      trim: true,
      default: "",
    },

    code: {
      type: String,
      trim: true,
      default: "",
    },

    className: {
      type: String,
      required: true,
      trim: true,
    },

    section: {
      type: String,
      trim: true,
      default: "All",
    },

    stream: {
      type: String,
      trim: true,
      default: "General",
    },

    type: {
      type: String,
      enum: ["Compulsory", "Optional", "Practical"],
      default: "Compulsory",
    },

    educationLevel: {
      type: String,
      enum: ["Basic", "Secondary", "Higher Secondary", "General"],
      default: "General",
    },

    curriculumBoard: {
      type: String,
      trim: true,
      default: "Nepal Curriculum / NEB",
    },

    fullMarks: {
      type: Number,
      default: null,
    },

    passMarks: {
      type: Number,
      default: null,
    },

    creditHours: {
      type: Number,
      default: null,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

subjectSchema.index({
  schoolId: 1,
  className: 1,
  section: 1,
  stream: 1,
  name: 1,
});

const Subject =
  mongoose.models.Subject || mongoose.model("Subject", subjectSchema);

export default Subject;