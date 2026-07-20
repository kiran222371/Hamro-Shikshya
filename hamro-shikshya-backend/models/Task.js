import mongoose from "mongoose";

/* =====================================================
   HOMEWORK SUBMISSION SCHEMA
===================================================== */

const submissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    studentName: {
      type: String,
      default: "",
      trim: true,
    },

    studentEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    answer: {
      type: String,
      default: "",
      trim: true,
    },

    submissionText: {
      type: String,
      default: "",
      trim: true,
    },

    fileUrl: {
      type: String,
      default: "",
      trim: true,
    },

    fileName: {
      type: String,
      default: "",
      trim: true,
    },

    fileOriginalName: {
      type: String,
      default: "",
      trim: true,
    },

    fileMimeType: {
      type: String,
      default: "",
      trim: true,
    },

    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "Submitted",
        "Checked",
        "Reviewed",
        "Needs Improvement",
        "Late",
      ],
      default: "Submitted",
      trim: true,
    },

    marks: {
      type: Number,
      default: null,
      min: [0, "Marks cannot be negative"],
    },

    feedback: {
      type: String,
      default: "",
      trim: true,
    },

    checkedAt: {
      type: Date,
      default: null,
    },

    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    teacherName: {
      type: String,
      default: "",
      trim: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

/* =====================================================
   HOMEWORK / TASK SCHEMA
===================================================== */

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Homework title is required"],
      trim: true,
      maxlength: [160, "Homework title cannot exceed 160 characters"],
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [5000, "Homework description is too long"],
    },

    /*
      Legacy subject text field retained for compatibility.
      New homework should also store subjectId, subjectName,
      subjectCode and subjectType.
    */
    subject: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    /*
      Central connection to the school's Subject collection.
      It is optional at schema level so older homework records
      continue to work. New homework will be validated in routes/tasks.js.
    */
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
      index: true,
    },

    /*
      Snapshot fields preserve the subject identity even if the
      administrator later renames or deactivates the Subject record.
    */
    subjectName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    subjectCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    subjectType: {
      type: String,
      enum: [
        "Compulsory",
        "Optional",
        "Practical",
        "Local Curriculum",
        "Technical/Vocational",
        "",
      ],
      default: "",
      trim: true,
    },

    stream: {
      type: String,
      default: "General",
      trim: true,
      index: true,
    },

    academicYear: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    curriculumBoard: {
      type: String,
      default: "Nepal Curriculum / NEB",
      trim: true,
    },

    curriculumVersion: {
      type: String,
      default: "",
      trim: true,
    },

    /*
      Optional maximum marks for the homework. This allows the
      teacher review form and future gradebook to validate marks.
    */
    maxMarks: {
      type: Number,
      default: null,
      min: [0, "Maximum marks cannot be negative"],
    },

    className: {
      type: String,
      required: [true, "Class is required"],
      trim: true,
      index: true,
    },

    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      index: true,
    },

    classId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    dueDate: {
      type: Date,
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["Draft", "Published", "Closed", "Archived"],
      default: "Published",
      index: true,
    },

    fileUrl: {
      type: String,
      default: "",
      trim: true,
    },

    fileName: {
      type: String,
      default: "",
      trim: true,
    },

    fileOriginalName: {
      type: String,
      default: "",
      trim: true,
    },

    fileMimeType: {
      type: String,
      default: "",
      trim: true,
    },

    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "School is required"],
      index: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher is required"],
      index: true,
    },

    teacherName: {
      type: String,
      default: "",
      trim: true,
    },

    submissions: {
      type: [submissionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

/* =====================================================
   NORMALISATION AND VALIDATION
===================================================== */

taskSchema.pre("validate", function () {
  const clean = (value) => String(value ?? "").trim();

  const canonicalSubjectName = clean(
    this.subjectName || this.subject
  ).replace(/\s+/g, " ");

  this.subjectName = canonicalSubjectName;
  this.subject = canonicalSubjectName;
  this.subjectCode = clean(this.subjectCode).toUpperCase();
  this.subjectType = clean(this.subjectType);
  this.stream = clean(this.stream) || "General";
  this.academicYear = clean(this.academicYear);
  this.curriculumBoard =
    clean(this.curriculumBoard) || "Nepal Curriculum / NEB";
  this.curriculumVersion = clean(this.curriculumVersion);

  this.className = clean(this.className);
  this.section = clean(this.section);
  this.classId =
    clean(this.classId) ||
    `${this.className}-${this.section || "all"}`;

  if (
    this.maxMarks !== null &&
    this.maxMarks !== undefined
  ) {
    this.submissions.forEach((submission) => {
      if (
        submission.marks !== null &&
        submission.marks !== undefined &&
        Number(submission.marks) > Number(this.maxMarks)
      ) {
        submission.invalidate(
          "marks",
          `Marks cannot be greater than the homework maximum of ${this.maxMarks}`
        );
      }
    });
  }

  this.submissions.forEach((submission) => {
    submission.studentName = clean(submission.studentName);
    submission.studentEmail = clean(submission.studentEmail).toLowerCase();

    const canonicalAnswer = clean(
      submission.answer || submission.submissionText
    );

    submission.answer = canonicalAnswer;
    submission.submissionText = canonicalAnswer;
    submission.updatedAt = new Date();
  });
});

/* =====================================================
   DATABASE INDEXES
===================================================== */

taskSchema.index({
  schoolId: 1,
  className: 1,
  section: 1,
  createdAt: -1,
});

taskSchema.index({
  schoolId: 1,
  subjectId: 1,
  className: 1,
  section: 1,
  createdAt: -1,
});

taskSchema.index({
  schoolId: 1,
  subjectName: 1,
  className: 1,
  section: 1,
});

taskSchema.index({
  teacherId: 1,
  className: 1,
  section: 1,
  createdAt: -1,
});

taskSchema.index({
  "submissions.studentId": 1,
  createdAt: -1,
});

/* =====================================================
   SAFE JSON OUTPUT
===================================================== */

taskSchema.set("toJSON", {
  virtuals: true,

  transform(_document, returnedObject) {
    returnedObject.id = returnedObject._id;
    delete returnedObject.__v;
    return returnedObject;
  },
});

/* =====================================================
   MODEL EXPORT
===================================================== */

const Task =
  mongoose.models.Task ||
  mongoose.model("Task", taskSchema);

export default Task;
