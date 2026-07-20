import mongoose from "mongoose";

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

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },

    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1])
          );
        },
        message:
          "Location coordinates must be an array like [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const schoolSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: true,
      trim: true,
    },

    // Legacy field. Keep this because your old database previously used "name".
    // This helps old code/database records remain compatible.
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
  { timestamps: true }
);

schoolSchema.pre("validate", function (next) {
  if (!this.name && this.schoolName) {
    this.name = this.schoolName;
  }

  if (!this.schoolName && this.name) {
    this.schoolName = this.name;
  }

  if (
    this.addressDetails &&
    Number.isFinite(Number(this.addressDetails.longitude)) &&
    Number.isFinite(Number(this.addressDetails.latitude)) &&
    !this.location
  ) {
    this.location = {
      type: "Point",
      coordinates: [
        Number(this.addressDetails.longitude),
        Number(this.addressDetails.latitude),
      ],
    };
  }

  next();
});

schoolSchema.index({ location: "2dsphere" });
schoolSchema.index({ schoolName: 1 });
schoolSchema.index({ name: 1 });

const School =
  mongoose.models.School || mongoose.model("School", schoolSchema);

export default School;