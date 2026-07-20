import mongoose from "mongoose";

const cleanText = (value) => String(value || "").trim();

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
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const schoolSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: [true, "School name is required."],
      trim: true,
      alias: "name",
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
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        default: undefined,
      },
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
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        ret.name = ret.schoolName;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

schoolSchema.pre("validate", function (next) {
  const possibleSchoolName = cleanText(
    this.schoolName ||
      this.name ||
      this.get("name") ||
      this._doc?.name ||
      this._doc?.school ||
      this._doc?.school_name
  );

  if (possibleSchoolName) {
    this.schoolName = possibleSchoolName;
  }

  this.email = cleanText(this.email).toLowerCase();
  this.address = cleanText(this.address);
  this.phone = cleanText(this.phone);
  this.website = cleanText(this.website);
  this.principalName = cleanText(this.principalName);
  this.adminName = cleanText(this.adminName);
  this.logoUrl = cleanText(this.logoUrl);

  const latitude = this.addressDetails?.latitude;
  const longitude = this.addressDetails?.longitude;

  if (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  ) {
    this.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  }

  next();
});

schoolSchema.index({ location: "2dsphere" });
schoolSchema.index({ schoolName: 1 });
schoolSchema.index({ email: 1 });

const School = mongoose.models.School || mongoose.model("School", schoolSchema);

export default School;