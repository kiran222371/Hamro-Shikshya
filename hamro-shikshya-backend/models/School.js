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
      default: "Point",
      required: true,
    },

    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            value.every((number) => Number.isFinite(Number(number)))
          );
        },
        message: "Coordinates must be [longitude, latitude]",
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

    address: {
      type: String,
      trim: true,
      default: "",
    },

    addressDetails: {
      type: addressDetailsSchema,
      default: () => ({}),
    },

    // Important:
    // location must be undefined unless valid coordinates exist.
    // Otherwise MongoDB 2dsphere index gives:
    // "Point must be an array or object, instead got type missing"
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

schoolSchema.pre("validate", function () {
  const currentCoordinates = this.location?.coordinates;

  const hasValidCoordinates =
    Array.isArray(currentCoordinates) &&
    currentCoordinates.length === 2 &&
    currentCoordinates.every((number) => Number.isFinite(Number(number)));

  if (hasValidCoordinates) {
    this.location = {
      type: "Point",
      coordinates: [
        Number(currentCoordinates[0]),
        Number(currentCoordinates[1]),
      ],
    };

    return;
  }

  const latitude = Number(this.addressDetails?.latitude);
  const longitude = Number(this.addressDetails?.longitude);

  const hasAddressCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  if (hasAddressCoordinates) {
    this.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };

    return;
  }

  this.location = undefined;
});

schoolSchema.virtual("name").get(function () {
  return this.schoolName;
});

schoolSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

schoolSchema.index({ location: "2dsphere" }, { sparse: true });
schoolSchema.index({ schoolName: 1 });
schoolSchema.index({ email: 1 });

const School = mongoose.models.School || mongoose.model("School", schoolSchema);

export default School;