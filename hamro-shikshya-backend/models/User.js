import mongoose from "mongoose";

/* =====================================================
   HELPER FUNCTIONS
===================================================== */

const cleanText = (value) => String(value ?? "").trim();

const cleanEmail = (value) =>
  cleanText(value).toLowerCase();

const cleanStringArray = (values) => {
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

const normalizeStream = (value) => {
  const cleanValue = cleanText(value);

  if (!cleanValue) {
    return "";
  }

  const normalized = cleanValue
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const streamMap = {
    science: "Science",
    management: "Management",
    commerce: "Management",
    humanities: "Humanities",
    arts: "Humanities",
    education: "Education",
    law: "Law",
    technical: "Technical",
    vocational: "Technical",
    "technical vocational": "Technical",
    general: "General",
  };

  return (
    streamMap[normalized] ||
    cleanValue
      .split(/\s+/)
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1).toLowerCase()
      )
      .join(" ")
  );
};

/* =====================================================
   TEACHER-ASSIGNED CLASS SCHEMA
===================================================== */

const assignedClassSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: [
        true,
        "Assigned class name is required",
      ],
      trim: true,
    },

    section: {
      type: String,
      required: [
        true,
        "Assigned class section is required",
      ],
      trim: true,
    },

    stream: {
      type: String,
      trim: true,
      default: "General",
    },

    /*
      Legacy subject-name list retained for compatibility.
    */
    subjects: {
      type: [String],
      default: [],
    },

    /*
      Central Subject records assigned to this teacher for
      this class and section.
    */
    subjectIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
        },
      ],
      default: [],
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   STUDENT GUARDIAN SCHEMA
===================================================== */

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
  {
    _id: false,
  }
);

/* =====================================================
   USER SCHEMA
===================================================== */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
      minlength: [
        2,
        "User name must contain at least 2 characters",
      ],
      maxlength: [
        100,
        "User name cannot exceed 100 characters",
      ],
    },

    /*
      The login email remains globally unique.

      This means every admin, teacher and student who uses
      an email to log in must have a different email address.

      Multiple schools can still register because each admin
      uses their own email and receives a separate schoolId.
    */
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    /*
      Public registration creates an admin.

      Teachers and students are created later by an
      authenticated admin belonging to the same school.
    */
    role: {
      type: String,
      enum: {
        values: ["admin", "teacher", "student"],
        message:
          "Role must be admin, teacher or student",
      },
      required: [true, "User role is required"],
      default: "student",
    },

    /*
      This field separates every institution's data.

      All admins, teachers and students belonging to one
      institution must have the same schoolId.
    */
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [
        true,
        "Every user must belong to a school or college",
      ],
      index: true,
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
      enum: {
        values: ["", "male", "female", "other"],
        message:
          "Gender must be male, female or other",
      },
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
      enum: {
        values: ["active", "deactivated"],
        message:
          "Account status must be active or deactivated",
      },
      default: "active",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    /* =================================================
       STUDENT FIELDS
    ================================================= */

    className: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    section: {
      type: String,
      trim: true,
      default: "",
      index: true,
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
      index: true,
    },

    /*
      For Classes 11 and 12 this should normally contain the
      student's programme/stream, such as Science, Management,
      Humanities, Education, Law or Technical.

      It remains a flexible string because individual schools
      may use additional programme names.
    */
    stream: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    /*
      Exact Subject records enrolled by the student.

      This is especially important for Classes 11 and 12,
      where students in the same stream may choose different
      optional subjects.

      Priority used by the subject API:
      1. subjectIds when this array is not empty
      2. otherwise the student's stream
      3. General/common subjects are also included
    */
    subjectIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
        },
      ],
      default: [],
      index: true,
    },

    /*
      Indicates whether the student's subject list should be
      resolved from the stream or from the exact subjectIds.
      The API can also infer "individual" whenever subjectIds
      contains at least one Subject record.
    */
    subjectEnrollmentMode: {
      type: String,
      enum: {
        values: ["stream", "individual"],
        message:
          "Subject enrollment mode must be stream or individual",
      },
      default: "stream",
    },

    studentStatus: {
      type: String,
      enum: {
        values: [
          "active",
          "graduated",
          "transferred",
          "dropout",
          "suspended",
        ],
        message: "Invalid student status",
      },
      default: "active",
    },

    guardian: {
      type: guardianSchema,
      default: () => ({}),
    },

    /* =================================================
       TEACHER FIELDS
    ================================================= */

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

    /*
      Legacy teacher subject-name list retained for
      compatibility with existing records and frontend code.
    */
    subjects: {
      type: [String],
      default: [],
    },

    /*
      Central Subject records assigned to the teacher.
    */
    teacherSubjectIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
        },
      ],
      default: [],
    },

    /*
      A teacher can be assigned to several classes,
      sections, streams and subjects.
    */
    assignedClasses: {
      type: [assignedClassSchema],
      default: [],
    },

    /* =================================================
       LOGIN INFORMATION
    ================================================= */

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   VALIDATION AND NORMALISATION
===================================================== */

userSchema.pre("validate", function () {
  if (this.name) {
    this.name = cleanText(this.name).replace(
      /\s+/g,
      " "
    );
  }

  if (this.email) {
    this.email = cleanEmail(this.email);
  }

  if (this.role) {
    const normalizedRole = cleanText(
      this.role
    ).toLowerCase();

    /*
      Compatibility with any older frontend that sends
      "principal" instead of "admin".
    */
    this.role =
      normalizedRole === "principal"
        ? "admin"
        : normalizedRole;
  }

  if (this.phone) {
    this.phone = cleanText(this.phone);
  }

  if (this.address) {
    this.address = cleanText(this.address);
  }

  this.className = cleanText(this.className);
  this.section = cleanText(this.section);
  this.rollNumber = cleanText(this.rollNumber);
  this.admissionNumber = cleanText(
    this.admissionNumber
  );
  this.studentCode = cleanText(
    this.studentCode
  );
  this.academicYear = cleanText(
    this.academicYear
  );
  this.employeeId = cleanText(this.employeeId);

  /*
    Normalize common stream names while still allowing
    school-specific programme labels.
  */
  this.stream = normalizeStream(this.stream);

  /*
    Keep the old isActive field and the newer accountStatus
    field synchronized.
  */
  if (
    this.accountStatus === "deactivated" ||
    this.isActive === false
  ) {
    this.accountStatus = "deactivated";
    this.isActive = false;
  } else {
    this.accountStatus = "active";
    this.isActive = true;
  }

  /*
    Remove empty and duplicate teacher subject names.
  */
  this.subjects = cleanStringArray(this.subjects);

  /*
    Remove invalid and duplicate Subject references.
  */
  this.subjectIds = cleanObjectIdArray(
    this.subjectIds
  );

  this.teacherSubjectIds =
    cleanObjectIdArray(
      this.teacherSubjectIds
    );

  /*
    An exact student subject list automatically uses
    individual enrollment mode.
  */
  if (
    this.role === "student" &&
    this.subjectIds.length > 0
  ) {
    this.subjectEnrollmentMode =
      "individual";
  }

  /*
    Classes 1-10 normally do not use a specialised stream.
    Keep them on General unless the school intentionally
    stores another programme name.
  */
  const classNumber = Number(this.className);

  if (
    this.role === "student" &&
    classNumber >= 1 &&
    classNumber <= 10 &&
    !this.stream
  ) {
    this.stream = "General";
  }

  /*
    Clean and remove duplicate assigned classes.

    A duplicate means the same class, section and stream.
  */
  if (Array.isArray(this.assignedClasses)) {
    const usedClassSections = new Set();

    this.assignedClasses = this.assignedClasses
      .map((assignedClass) => {
        const assignedClassName = cleanText(
          assignedClass?.className
        );

        const assignedSection = cleanText(
          assignedClass?.section
        );

        const assignedStream =
          normalizeStream(
            assignedClass?.stream
          ) || "General";

        const assignedSubjects =
          cleanStringArray(
            assignedClass?.subjects
          );

        const assignedSubjectIds =
          cleanObjectIdArray(
            assignedClass?.subjectIds
          );

        return {
          className: assignedClassName,
          section: assignedSection,
          stream: assignedStream,
          subjects: assignedSubjects,
          subjectIds: assignedSubjectIds,
        };
      })
      .filter((assignedClass) => {
        if (
          !assignedClass.className ||
          !assignedClass.section
        ) {
          return false;
        }

        const classSectionKey = [
          assignedClass.className,
          assignedClass.section,
          assignedClass.stream,
        ]
          .join("-")
          .toLowerCase();

        if (
          usedClassSections.has(classSectionKey)
        ) {
          return false;
        }

        usedClassSections.add(classSectionKey);

        return true;
      });
  }

  /*
    Compatibility for an older teacher record that only has
    className and section instead of assignedClasses.
  */
  if (
    this.role === "teacher" &&
    this.assignedClasses.length === 0 &&
    this.className &&
    this.section
  ) {
    this.assignedClasses = [
      {
        className: this.className,
        section: this.section,
        stream:
          normalizeStream(this.stream) ||
          "General",
        subjects: this.subjects,
        subjectIds:
          this.teacherSubjectIds,
      },
    ];
  }

  /*
    Build a top-level teacher Subject reference list from
    assignedClasses when it is missing.
  */
  if (
    this.role === "teacher" &&
    this.teacherSubjectIds.length === 0
  ) {
    this.teacherSubjectIds =
      cleanObjectIdArray(
        this.assignedClasses.flatMap(
          (assignedClass) =>
            assignedClass.subjectIds || []
        )
      );
  }

  /*
    Normalize guardian information.
  */
  if (this.guardian) {
    this.guardian.name = cleanText(
      this.guardian.name
    );

    this.guardian.phone = cleanText(
      this.guardian.phone
    );

    this.guardian.email = cleanEmail(
      this.guardian.email
    );

    this.guardian.relation = cleanText(
      this.guardian.relation
    );
  }
});

/* =====================================================
   DATABASE INDEXES
===================================================== */

/*
  Used when an admin requests all teachers or students
  belonging to their school.
*/
userSchema.index({
  schoolId: 1,
  role: 1,
});

/*
  Used for class, section and stream student searches.
*/
userSchema.index({
  schoolId: 1,
  className: 1,
  section: 1,
  stream: 1,
  role: 1,
});

/*
  Used for finding students enrolled in a Subject.
*/
userSchema.index({
  schoolId: 1,
  role: 1,
  subjectIds: 1,
});

/*
  Used when searching for teachers assigned to a class.
*/
userSchema.index({
  schoolId: 1,
  "assignedClasses.className": 1,
  "assignedClasses.section": 1,
  "assignedClasses.stream": 1,
});

/*
  Used for finding teachers assigned to a Subject.
*/
userSchema.index({
  schoolId: 1,
  role: 1,
  teacherSubjectIds: 1,
});

/*
  Used for searching active users within one school.
*/
userSchema.index({
  schoolId: 1,
  role: 1,
  accountStatus: 1,
});

/*
  These fields are not globally unique because different
  schools may use the same roll number, employee ID or
  admission number.
*/
userSchema.index({
  schoolId: 1,
  studentCode: 1,
});

userSchema.index({
  schoolId: 1,
  admissionNumber: 1,
});

userSchema.index({
  schoolId: 1,
  employeeId: 1,
});

/* =====================================================
   SAFE USER OUTPUT
===================================================== */

userSchema.set("toJSON", {
  virtuals: true,

  transform(_document, returnedObject) {
    returnedObject.id = returnedObject._id;

    delete returnedObject.password;
    delete returnedObject.__v;

    return returnedObject;
  },
});

userSchema.set("toObject", {
  virtuals: true,

  transform(_document, returnedObject) {
    delete returnedObject.password;
    delete returnedObject.__v;

    return returnedObject;
  },
});

/* =====================================================
   MODEL EXPORT
===================================================== */

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;
