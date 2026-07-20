import mongoose from "mongoose";

/* =====================================================
   CONSTANTS
===================================================== */

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const CLASS_TYPES = [
  "Regular Class",
  "Practical",
  "Lab",
  "Tutorial",
  "Assembly",
  "Break",
  "Other",
];

/* =====================================================
   HELPERS
===================================================== */

const cleanText = (value) =>
  String(value ?? "").trim();

const normalizeDay = (value) => {
  const cleaned = cleanText(value).toLowerCase();

  const matchedDay = DAYS_OF_WEEK.find(
    (day) => day.toLowerCase() === cleaned
  );

  return matchedDay || "";
};

const isValidTime = (value) => {
  if (!value) return false;

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    String(value)
  );
};

const timeToMinutes = (value) => {
  if (!isValidTime(value)) return null;

  const [hours, minutes] = String(value)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
};

/* =====================================================
   TIMETABLE SCHEMA
===================================================== */

const timetableSchema = new mongoose.Schema(
  {
    /*
      The institution that owns this timetable entry.
    */
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [
        true,
        "Timetable entry must belong to a school or college",
      ],
      index: true,
    },

    /*
      Student group that receives this class.
    */
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

    stream: {
      type: String,
      trim: true,
      default: "General",
      index: true,
    },

    academicYear: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    /*
      Weekly recurrence information.
    */
    dayOfWeek: {
      type: String,
      enum: {
        values: DAYS_OF_WEEK,
        message: "Invalid day of week",
      },
      required: [true, "Day of week is required"],
      index: true,
    },

    dayOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    startTime: {
      type: String,
      required: [true, "Start time is required"],
      trim: true,
      validate: {
        validator: isValidTime,
        message: "Start time must use HH:mm format",
      },
    },

    endTime: {
      type: String,
      required: [true, "End time is required"],
      trim: true,
      validate: {
        validator: isValidTime,
        message: "End time must use HH:mm format",
      },
    },

    periodNumber: {
      type: Number,
      default: null,
      min: [1, "Period number must be at least 1"],
    },

    /*
      Subject identity.

      Snapshot fields are stored alongside subjectId so old
      timetable records remain readable if the subject is later
      renamed or deactivated.
    */
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
      index: true,
    },

    subjectName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    subjectCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    /*
      Teacher identity.

      Snapshot name is stored for historical display.
    */
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    teacherName: {
      type: String,
      trim: true,
      default: "",
    },

    room: {
      type: String,
      trim: true,
      default: "",
    },

    classType: {
      type: String,
      enum: {
        values: CLASS_TYPES,
        message: "Invalid class type",
      },
      default: "Regular Class",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [
        1000,
        "Timetable notes cannot exceed 1000 characters",
      ],
    },

    /*
      Allows one timetable to be active only for a term or
      academic period without deleting old schedules.
    */
    validFrom: {
      type: Date,
      default: null,
      index: true,
    },

    validUntil: {
      type: Date,
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   NORMALISATION AND VALIDATION
===================================================== */

timetableSchema.pre("validate", function () {
  this.className = cleanText(this.className);
  this.section = cleanText(this.section);
  this.stream = cleanText(this.stream) || "General";
  this.academicYear = cleanText(this.academicYear);

  this.dayOfWeek = normalizeDay(this.dayOfWeek);
  this.dayOrder = DAYS_OF_WEEK.indexOf(this.dayOfWeek);

  this.startTime = cleanText(this.startTime);
  this.endTime = cleanText(this.endTime);

  this.subjectName = cleanText(this.subjectName);
  this.subjectCode = cleanText(this.subjectCode).toUpperCase();
  this.teacherName = cleanText(this.teacherName);
  this.room = cleanText(this.room);
  this.notes = cleanText(this.notes);

  const startMinutes = timeToMinutes(this.startTime);
  const endMinutes = timeToMinutes(this.endTime);

  if (
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes <= startMinutes
  ) {
    this.invalidate(
      "endTime",
      "End time must be later than start time"
    );
  }

  if (
    this.validFrom &&
    this.validUntil &&
    new Date(this.validUntil) < new Date(this.validFrom)
  ) {
    this.invalidate(
      "validUntil",
      "Valid-until date cannot be before valid-from date"
    );
  }

  /*
    Break, assembly and miscellaneous periods may not have
    a Subject record. Normal teaching periods should carry
    at least a readable subject name.
  */
  const doesNotRequireSubject = [
    "Break",
    "Assembly",
    "Other",
  ].includes(this.classType);

  if (
    !doesNotRequireSubject &&
    !this.subjectId &&
    !this.subjectName
  ) {
    this.invalidate(
      "subjectName",
      "Subject is required for a teaching period"
    );
  }
});

/* =====================================================
   DATABASE INDEXES
===================================================== */

/*
  Main student timetable query.
*/
timetableSchema.index({
  schoolId: 1,
  className: 1,
  section: 1,
  stream: 1,
  isActive: 1,
  dayOrder: 1,
  startTime: 1,
});

/*
  Teacher schedule query.
*/
timetableSchema.index({
  schoolId: 1,
  teacherId: 1,
  isActive: 1,
  dayOrder: 1,
  startTime: 1,
});

/*
  Subject timetable query.
*/
timetableSchema.index({
  schoolId: 1,
  subjectId: 1,
  isActive: 1,
  dayOrder: 1,
  startTime: 1,
});

/*
  Helps detect duplicate or overlapping start slots for the
  same class and section. Full conflict validation belongs in
  routes/timetable.js because end-time overlap must also be checked.
*/
timetableSchema.index({
  schoolId: 1,
  className: 1,
  section: 1,
  stream: 1,
  dayOfWeek: 1,
  startTime: 1,
  academicYear: 1,
});

/* =====================================================
   SAFE OUTPUT
===================================================== */

timetableSchema.set("toJSON", {
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

const Timetable =
  mongoose.models.Timetable ||
  mongoose.model("Timetable", timetableSchema);

export default Timetable;
