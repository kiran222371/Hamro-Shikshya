import mongoose from "mongoose";

/* =====================================================
   HELPERS
===================================================== */

const cleanText = (value) => String(value ?? "").trim();

const cleanTextArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
    ),
  ];
};

const cleanObjectIdArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const usedIds = new Set();

  return values
    .map((value) => {
      if (value && typeof value === "object") {
        return value._id || value.id || "";
      }

      return value;
    })
    .map((value) => cleanText(value))
    .filter((value) => {
      if (
        !value ||
        !mongoose.Types.ObjectId.isValid(value) ||
        usedIds.has(value)
      ) {
        return false;
      }

      usedIds.add(value);
      return true;
    });
};

const makeSubjectKey = ({
  name,
  className,
  stream,
  academicYear,
}) => {
  return [
    cleanText(name).toLowerCase(),
    cleanText(className).toLowerCase(),
    cleanText(stream || "General").toLowerCase(),
    cleanText(academicYear || "current").toLowerCase(),
  ]
    .filter(Boolean)
    .join("::");
};

/* =====================================================
   SUBJECT SCHEMA
===================================================== */

const subjectSchema = new mongoose.Schema(
  {
    /*
      Canonical subject display name.

      subjectName remains for compatibility with older
      frontend and backend code.
    */
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      maxlength: [
        120,
        "Subject name cannot exceed 120 characters",
      ],
    },

    subjectName: {
      type: String,
      trim: true,
      default: "",
    },

    /*
      This may contain an official curriculum/school code or
      an internal application code. The application must not
      assume a generated template code is an official NEB code.
    */
    subjectCode: {
      type: String,
      trim: true,
      default: "",
      maxlength: [
        60,
        "Subject code cannot exceed 60 characters",
      ],
    },

    code: {
      type: String,
      trim: true,
      default: "",
    },

    subjectKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    className: {
      type: String,
      required: [true, "Class is required"],
      trim: true,
      index: true,
    },

    /* Legacy single-section field. */
    section: {
      type: String,
      trim: true,
      default: "All",
    },

    /* New multi-section field. Use ["All"] for all sections. */
    sections: {
      type: [String],
      default: ["All"],
    },

    stream: {
      type: String,
      trim: true,
      default: "General",
      index: true,
    },

    type: {
      type: String,
      enum: {
        values: [
          "Compulsory",
          "Optional",
          "Practical",
          "Local Curriculum",
          "Technical/Vocational",
        ],
        message: "Invalid subject type",
      },
      default: "Compulsory",
      index: true,
    },

    educationLevel: {
      type: String,
      enum: {
        values: [
          "Basic",
          "Secondary",
          "Higher Secondary",
          "General",
        ],
        message: "Invalid education level",
      },
      default: "General",
    },

    curriculumBoard: {
      type: String,
      trim: true,
      default: "Nepal Curriculum / NEB",
    },

    curriculumVersion: {
      type: String,
      trim: true,
      default: "",
    },

    /*
      Stored as text so schools may use Nepali, English,
      or combined academic-year labels.
    */
    academicYear: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    fullMarks: {
      type: Number,
      default: null,
      min: [0, "Full marks cannot be negative"],
    },

    passMarks: {
      type: Number,
      default: null,
      min: [0, "Pass marks cannot be negative"],
    },

    creditHours: {
      type: Number,
      default: null,
      min: [0, "Credit hours cannot be negative"],
    },

    /* Legacy single-teacher field. */
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* New multi-teacher field. */
    teacherIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [
        true,
        "Subject must belong to a school or college",
      ],
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [
        500,
        "Subject description cannot exceed 500 characters",
      ],
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   NORMALISATION AND VALIDATION
===================================================== */

subjectSchema.pre("validate", function () {
  const canonicalName = cleanText(
    this.name || this.subjectName
  ).replace(/\s+/g, " ");

  const canonicalCode = cleanText(
    this.subjectCode || this.code
  ).toUpperCase();

  this.name = canonicalName;
  this.subjectName = canonicalName;
  this.subjectCode = canonicalCode;
  this.code = canonicalCode;

  this.className = cleanText(this.className);
  this.stream = cleanText(this.stream) || "General";
  this.academicYear = cleanText(this.academicYear);
  this.curriculumVersion = cleanText(
    this.curriculumVersion
  );
  this.curriculumBoard =
    cleanText(this.curriculumBoard) ||
    "Nepal Curriculum / NEB";

  const normalizedSections = cleanTextArray(
    Array.isArray(this.sections)
      ? this.sections
      : []
  );

  const legacySection = cleanText(this.section);

  if (
    normalizedSections.length === 0 &&
    legacySection
  ) {
    normalizedSections.push(legacySection);
  }

  if (normalizedSections.length === 0) {
    normalizedSections.push("All");
  }

  const containsAll = normalizedSections.some(
    (value) => value.toLowerCase() === "all"
  );

  this.sections = containsAll
    ? ["All"]
    : normalizedSections;

  this.section = this.sections[0] || "All";

  const normalizedTeacherIds =
    cleanObjectIdArray(this.teacherIds);

  const legacyTeacherId =
    this.teacherId?._id ||
    this.teacherId ||
    "";

  if (
    legacyTeacherId &&
    mongoose.Types.ObjectId.isValid(
      String(legacyTeacherId)
    ) &&
    !normalizedTeacherIds.includes(
      String(legacyTeacherId)
    )
  ) {
    normalizedTeacherIds.unshift(
      String(legacyTeacherId)
    );
  }

  this.teacherIds = normalizedTeacherIds;
  this.teacherId =
    normalizedTeacherIds[0] || null;

  this.subjectKey = makeSubjectKey({
    name: this.name,
    className: this.className,
    stream: this.stream,
    academicYear: this.academicYear,
  });

  if (
    this.fullMarks !== null &&
    this.passMarks !== null &&
    Number(this.passMarks) >
      Number(this.fullMarks)
  ) {
    this.invalidate(
      "passMarks",
      "Pass marks cannot be greater than full marks"
    );
  }
});

/* =====================================================
   DATABASE INDEXES
===================================================== */

subjectSchema.index({
  schoolId: 1,
  className: 1,
  stream: 1,
  academicYear: 1,
  isActive: 1,
});

subjectSchema.index({
  schoolId: 1,
  className: 1,
  sections: 1,
  isActive: 1,
});

subjectSchema.index({
  schoolId: 1,
  teacherIds: 1,
  className: 1,
  isActive: 1,
});

subjectSchema.index({
  schoolId: 1,
  subjectKey: 1,
  sections: 1,
});

/* =====================================================
   SAFE OUTPUT
===================================================== */

subjectSchema.set("toJSON", {
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

const Subject =
  mongoose.models.Subject ||
  mongoose.model("Subject", subjectSchema);

export default Subject;
