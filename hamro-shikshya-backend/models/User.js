import mongoose from "mongoose";

const VALID_ROLES = ["admin", "teacher", "student"];

const cleanText = (value) => String(value || "").trim();

const cleanEmail = (value) => cleanText(value).toLowerCase();

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
      default: "A",
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
      required: [true, "Name is required."],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required."],
    },

    role: {
      type: String,
      enum: VALID_ROLES,
      required: [true, "Role is required."],
      lowercase: true,
      trim: true,
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "School ID is required."],
    },

    schoolName: {
      type: String,
      trim: true,
      default: "",
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
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

userSchema.pre("validate", function (next) {
  this.name = cleanText(this.name);
  this.email = cleanEmail(this.email);
  this.role = cleanText(this.role).toLowerCase();

  if (this.schoolName) {
    this.schoolName = cleanText(this.schoolName);
  }

  this.phone = cleanText(this.phone);
  this.address = cleanText(this.address);
  this.className = cleanText(this.className);
  this.section = cleanText(this.section);
  this.rollNumber = cleanText(this.rollNumber);
  this.admissionNumber = cleanText(this.admissionNumber);
  this.studentCode = cleanText(this.studentCode);
  this.academicYear = cleanText(this.academicYear);
  this.stream = cleanText(this.stream);
  this.employeeId = cleanText(this.employeeId);
  this.qualification = cleanText(this.qualification);

  if (this.guardian) {
    this.guardian.name = cleanText(this.guardian.name);
    this.guardian.phone = cleanText(this.guardian.phone);
    this.guardian.email = cleanEmail(this.guardian.email);
    this.guardian.relation = cleanText(this.guardian.relation);
  }

  next();
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ schoolId: 1, role: 1 });
userSchema.index({ schoolId: 1, className: 1, section: 1 });
userSchema.index({
  schoolId: 1,
  "assignedClasses.className": 1,
  "assignedClasses.section": 1,
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;