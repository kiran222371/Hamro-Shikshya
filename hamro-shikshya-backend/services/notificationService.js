import Notification from "../models/Notification.js";
import User from "../models/User.js";

const cleanText = (value) => String(value ?? "").trim();

const escapeRegExp = (value) =>
  cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildExactTextMatch = (value) => ({
  $regex: `^${escapeRegExp(value)}$`,
  $options: "i",
});

const safeNotificationError = (label, error) => {
  console.error(`Notification error (${label}):`, error?.message || error);
};

export const createNotification = async ({
  recipientId,
  recipientRole,
  senderId = null,
  senderName = "",
  senderRole = "",
  schoolId,
  type,
  title,
  message,
  relatedId = "",
  relatedModel = "",
  relatedRoute = "",
  className = "",
  section = "",
  metadata = {},
}) => {
  if (!recipientId || !recipientRole || !schoolId || !type || !title || !message) {
    return null;
  }

  try {
    return await Notification.create({
      recipientId,
      recipientRole,
      senderId: senderId || null,
      senderName: cleanText(senderName),
      senderRole: cleanText(senderRole),
      schoolId,
      type: cleanText(type),
      title: cleanText(title),
      message: cleanText(message),
      relatedId: cleanText(relatedId),
      relatedModel: cleanText(relatedModel),
      relatedRoute: cleanText(relatedRoute),
      className: cleanText(className),
      section: cleanText(section),
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
  } catch (error) {
    safeNotificationError(type, error);
    return null;
  }
};

export const notifyClassStudents = async ({
  schoolId,
  className,
  section,
  senderId = null,
  senderName = "",
  senderRole = "",
  type,
  title,
  message,
  relatedId = "",
  relatedModel = "",
  relatedRoute = "/student/overview",
  metadata = {},
}) => {
  const cleanClassName = cleanText(className);
  const cleanSection = cleanText(section);

  if (!schoolId || !cleanClassName || !type || !title || !message) {
    return [];
  }

  try {
    const query = {
      schoolId,
      role: "student",
      className: buildExactTextMatch(cleanClassName),
      isActive: { $ne: false },
      accountStatus: { $nin: ["deactivated", "inactive"] },
    };

    if (cleanSection && cleanSection.toLowerCase() !== "all") {
      query.section = buildExactTextMatch(cleanSection);
    }

    const students = await User.find(query).select("_id role");

    if (students.length === 0) {
      return [];
    }

    const notifications = students.map((student) => ({
      recipientId: student._id,
      recipientRole: "student",
      senderId: senderId || null,
      senderName: cleanText(senderName),
      senderRole: cleanText(senderRole),
      schoolId,
      type: cleanText(type),
      title: cleanText(title),
      message: cleanText(message),
      relatedId: cleanText(relatedId),
      relatedModel: cleanText(relatedModel),
      relatedRoute: cleanText(relatedRoute),
      className: cleanClassName,
      section: cleanSection,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      isRead: false,
      readAt: null,
    }));

    return await Notification.insertMany(notifications, {
      ordered: false,
    });
  } catch (error) {
    safeNotificationError(type, error);
    return [];
  }
};
