import mongoose from "mongoose";

/* =====================================================
   HELPER FUNCTIONS
===================================================== */

const cleanText = (value) => String(value ?? "").trim();

const cleanSchoolName = (value) =>
  cleanText(value).replace(/\s+/g, " ");

const toValidNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
};

const isValidLongitude = (value) => {
  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
};

const isValidLatitude = (value) => {
  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
};

/* =====================================================
   ADDRESS DETAILS SCHEMA
===================================================== */

const addressDetailsSchema = new mongoose.Schema(
  {
    formattedAddress: {
      type: String,
      trim: true,
      default: "",
    },

    addressLine1: {
      type: String,
      trim: true,
      default: "",
    },

    municipality: {
      type: String,
      trim: true,
      default: "",
    },

    district: {
      type: String,
      trim: true,
      default: "",
    },

    province: {
      type: String,
      trim: true,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      default: "Nepal",
    },

    postalCode: {
      type: String,
      trim: true,
      default: "",
    },

    placeId: {
      type: String,
      trim: true,
      default: "",
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   GEO LOCATION SCHEMA
===================================================== */

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },

    /*
      GeoJSON coordinates must always be:

      [longitude, latitude]
    */
    coordinates: {
      type: [Number],
      required: true,

      validate: {
        validator(value) {
          if (
            !Array.isArray(value) ||
            value.length !== 2
          ) {
            return false;
          }

          const longitude = Number(value[0]);
          const latitude = Number(value[1]);

          return (
            isValidLongitude(longitude) &&
            isValidLatitude(latitude)
          );
        },

        message:
          "Location coordinates must be valid and use the format [longitude, latitude]",
      },
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   SCHOOL SCHEMA
===================================================== */

const schoolSchema = new mongoose.Schema(
  {
    /*
      Every school document automatically receives its own
      MongoDB _id.

      That _id is used as schoolId for admins, teachers and
      students belonging to this school.
    */
    schoolName: {
      type: String,
      required: [
        true,
        "School or college name is required",
      ],
      trim: true,
      minlength: [
        2,
        "School or college name must contain at least 2 characters",
      ],
      maxlength: [
        150,
        "School or college name cannot exceed 150 characters",
      ],
    },

    /*
      Legacy compatibility field.

      Some older parts of the project or old database records
      may use "name" instead of "schoolName".
    */
    name: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    addressDetails: {
      type: addressDetailsSchema,
      default: () => ({}),
    },

    location: {
      type: locationSchema,
      default: undefined,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    /*
      This is the institution's contact email.

      It is deliberately not unique because the unique login
      email is stored in the User collection. Different school
      branches may use the same institution contact email.
    */
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      default: "",
    },

    principalName: {
      type: String,
      trim: true,
      default: "",
    },

    adminName: {
      type: String,
      trim: true,
      default: "",
    },

    logoUrl: {
      type: String,
      trim: true,
      default: "",
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
   VALIDATION AND DATA NORMALISATION
===================================================== */

schoolSchema.pre("validate", function () {
  /*
    Keep schoolName and legacy name compatible.

    If schoolName is changed, update name.
    If old code changes name, update schoolName.
  */
  if (
    this.isModified("schoolName") &&
    this.schoolName
  ) {
    this.schoolName = cleanSchoolName(
      this.schoolName
    );

    this.name = this.schoolName;
  } else if (
    this.isModified("name") &&
    this.name
  ) {
    this.name = cleanSchoolName(this.name);
    this.schoolName = this.name;
  } else if (!this.schoolName && this.name) {
    this.schoolName = cleanSchoolName(this.name);
  } else if (!this.name && this.schoolName) {
    this.name = cleanSchoolName(this.schoolName);
  }

  if (this.schoolName) {
    this.schoolName = cleanSchoolName(
      this.schoolName
    );
  }

  if (this.name) {
    this.name = cleanSchoolName(this.name);
  }

  if (this.email) {
    this.email = cleanText(this.email).toLowerCase();
  }

  /*
    Keep the simple address and detailed address compatible.
  */
  if (
    !this.address &&
    this.addressDetails?.formattedAddress
  ) {
    this.address =
      this.addressDetails.formattedAddress;
  }

  if (
    this.address &&
    this.addressDetails &&
    !this.addressDetails.formattedAddress
  ) {
    this.addressDetails.formattedAddress =
      this.address;
  }

  /*
    Convert address latitude and longitude into GeoJSON.

    Important:
    The old code converted null into 0 using Number(null).
    That could incorrectly create location [0, 0] for schools
    without an address. This version prevents that problem.
  */
  const longitude = toValidNumber(
    this.addressDetails?.longitude
  );

  const latitude = toValidNumber(
    this.addressDetails?.latitude
  );

  if (
    isValidLongitude(longitude) &&
    isValidLatitude(latitude)
  ) {
    this.addressDetails.longitude = longitude;
    this.addressDetails.latitude = latitude;

    this.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  } else if (
    this.location?.coordinates &&
    Array.isArray(this.location.coordinates) &&
    this.location.coordinates.length === 2
  ) {
    /*
      If location was provided directly, copy it back into
      addressDetails so both formats remain consistent.
    */
    const locationLongitude = toValidNumber(
      this.location.coordinates[0]
    );

    const locationLatitude = toValidNumber(
      this.location.coordinates[1]
    );

    if (
      isValidLongitude(locationLongitude) &&
      isValidLatitude(locationLatitude)
    ) {
      this.location.type = "Point";

      this.location.coordinates = [
        locationLongitude,
        locationLatitude,
      ];

      this.addressDetails.longitude =
        locationLongitude;

      this.addressDetails.latitude =
        locationLatitude;
    }
  }
});

/* =====================================================
   DATABASE INDEXES
===================================================== */

/*
  These indexes improve searching.

  They are NOT unique because several schools or branches may
  have similar names. MongoDB _id separates every school.
*/
schoolSchema.index(
  { schoolName: 1 },
  { unique: false }
);

schoolSchema.index(
  { name: 1 },
  { unique: false }
);

schoolSchema.index(
  { schoolName: 1, isActive: 1 },
  { unique: false }
);

/*
  Used for location-based school searches.
*/
schoolSchema.index({
  location: "2dsphere",
});
/* =====================================================
   OUTPUT SETTINGS
===================================================== */

schoolSchema.set("toJSON", {
  virtuals: true,

  transform(_document, returnedObject) {
    returnedObject.id = returnedObject._id;

    delete returnedObject.__v;

    return returnedObject;
  },
});

schoolSchema.set("toObject", {
  virtuals: true,
});

/* =====================================================
   MODEL EXPORT
===================================================== */

const School =
  mongoose.models.School ||
  mongoose.model("School", schoolSchema);

export default School;