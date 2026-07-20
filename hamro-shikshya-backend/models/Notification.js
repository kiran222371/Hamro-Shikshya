import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification recipient is required"],
      index: true,
    },

    recipientRole: {
      type: String,
      enum: ["admin", "teacher", "student"],
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    senderName: {
      type: String,
      trim: true,
      default: "",
    },

    senderRole: {
      type: String,
      trim: true,
      default: "",
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "Notification school is required"],
      index: true,
    },

    type: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },

    message: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },

    relatedId: {
      type: String,
      trim: true,
      default: "",
    },

    relatedModel: {
      type: String,
      trim: true,
      default: "",
    },

    relatedRoute: {
      type: String,
      trim: true,
      default: "",
    },

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

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({
  recipientId: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index({
  schoolId: 1,
  recipientRole: 1,
  createdAt: -1,
});

notificationSchema.set("toJSON", {
  virtuals: true,
  transform(_document, returnedObject) {
    returnedObject.id = returnedObject._id;
    delete returnedObject.__v;
    return returnedObject;
  },
});

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
