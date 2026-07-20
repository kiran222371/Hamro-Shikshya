import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: "",
      trim: true,
    },

    classId: {
      type: String,
      default: "",
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

    teacherName: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

noticeSchema.index({
  classId: 1,
  className: 1,
  section: 1,
  schoolId: 1,
});

const Notice = mongoose.model("Notice", noticeSchema);

export default Notice;