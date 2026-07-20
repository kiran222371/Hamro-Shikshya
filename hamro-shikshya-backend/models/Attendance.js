import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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

    status: {
      type: String,
      enum: ["Present", "Absent", "Late"],
      default: "Present",
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
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

    markedBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({
  studentId: 1,
  classId: 1,
  className: 1,
  section: 1,
  date: 1,
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;