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

    subjects: {
      type: [String],
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

    subjects: {
      type: [String],
      default: [],
    },

    /*
      A teacher can be assigned to several classes,
      sections and subjects.
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

  if (this.className) {
    this.className = cleanText(this.className);
  }

  if (this.section) {
    this.section = cleanText(this.section);
  }

  if (this.rollNumber) {
    this.rollNumber = cleanText(this.rollNumber);
  }

  if (this.admissionNumber) {
    this.admissionNumber = cleanText(
      this.admissionNumber
    );
  }

  if (this.studentCode) {
    this.studentCode = cleanText(
      this.studentCode
    );
  }

  if (this.employeeId) {
    this.employeeId = cleanText(this.employeeId);
  }

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
    Remove empty and duplicate teacher subjects.
  */
  this.subjects = cleanStringArray(this.subjects);

  /*
    Clean and remove duplicate assigned classes.

    A duplicate means the same class and section.
  */
  if (Array.isArray(this.assignedClasses)) {
    const usedClassSections = new Set();

    this.assignedClasses = this.assignedClasses
      .map((assignedClass) => {
        const className = cleanText(
          assignedClass?.className
        );

        const section = cleanText(
          assignedClass?.section
        );

        const subjects = cleanStringArray(
          assignedClass?.subjects
        );

        return {
          className,
          section,
          subjects,
        };
      })
      .filter((assignedClass) => {
        if (
          !assignedClass.className ||
          !assignedClass.section
        ) {
          return false;
        }

        const classSectionKey =
          `${assignedClass.className}-${assignedClass.section}`.toLowerCase();

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
        subjects: this.subjects,
      },
    ];
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
  Used for class and section student searches.
*/
userSchema.index({
  schoolId: 1,
  className: 1,
  section: 1,
  role: 1,
});

/*
  Used when searching for teachers assigned to a class.
*/
userSchema.index({
  schoolId: 1,
  "assignedClasses.className": 1,
  "assignedClasses.section": 1,
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