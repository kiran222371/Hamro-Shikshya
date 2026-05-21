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
  { timestamps: true }
);

schoolSchema.index({ location: "2dsphere" });
schoolSchema.index({ schoolName: 1 });

const School = mongoose.models.School || mongoose.model("School", schoolSchema);

export default School;