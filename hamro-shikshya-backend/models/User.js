import mongoose from "mongoose";

const assignedClassSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
      trim: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
    },

    subjects: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const guardianSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    relation: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      required: true,
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    gender: {
      type: String,
      enum: ["", "male", "female", "other"],
      default: "",
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    profileImage: {
      type: String,
      trim: true,
      default: "",
    },

    accountStatus: {
      type: String,
      enum: ["active", "deactivated"],
      default: "active",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ================= STUDENT FIELDS =================
    className: {
      type: String,
      trim: true,
      default: "",
    },

    section: {
      type: String,
      trim: true,
      default: "",
    },

    rollNumber: {
      type: String,
      trim: true,
      default: "",
    },

    admissionNumber: {
      type: String,
      trim: true,
      default: "",
    },

    studentCode: {
      type: String,
      trim: true,
      default: "",
    },

    academicYear: {
      type: String,
      trim: true,
      default: "",
    },

    stream: {
      type: String,
      trim: true,
      default: "",
    },

    studentStatus: {
      type: String,
      enum: ["active", "graduated", "transferred", "dropout", "suspended"],
      default: "active",
    },

    guardian: {
      type: guardianSchema,
      default: () => ({}),
    },

    // ================= TEACHER FIELDS =================
    employeeId: {
      type: String,
      trim: true,
      default: "",
    },

    qualification: {
      type: String,
      trim: true,
      default: "",
    },

    subjects: {
      type: [String],
      default: [],
    },

    assignedClasses: {
      type: [assignedClassSchema],
      default: [],
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ schoolId: 1, role: 1 });
userSchema.index({ schoolId: 1, className: 1, section: 1 });
userSchema.index({
  schoolId: 1,
  "assignedClasses.className": 1,
  "assignedClasses.section": 1,
});

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;