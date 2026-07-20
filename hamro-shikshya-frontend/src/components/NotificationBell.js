import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api";

const POLL_INTERVAL_MS = 20000;

const toNotificationsArray = (response) => {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.notifications)) return body.notifications;
  if (Array.isArray(body?.data)) return body.data;

  return [];
};

const getNotificationId = (notification) =>
  notification?._id || notification?.id || "";

const formatRelativeTime = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const seconds = Math.max(
    Math.floor((Date.now() - date.getTime()) / 1000),
    0
  );

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};

const getNotificationIcon = (type) => {
  const icons = {
    homework_created: "📚",
    homework_submitted: "✅",
    homework_resubmitted: "🔁",
    homework_reviewed: "📝",
    attendance_marked: "🗓️",
    exam_created: "📋",
    result_published: "🏆",
    result_updated: "🏆",
    notice_created: "📢",
    account_created: "👤",
    class_assignment_changed: "🏫",
  };

  return icons[type] || "🔔";
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      setError("");

      const response = await getNotifications({
        limit: 30,
        page: 1,
      });

      const list = toNotificationsArray(response);
      const count = Number(
        response?.data?.unreadCount ??
          list.filter((item) => !item.isRead).length
      );

      setNotifications(list);
      setUnreadCount(Number.isFinite(count) ? count : 0);
    } catch (requestError) {
      console.error("Load notifications error:", requestError);

      if (!silent) {
        setError(
          requestError?.response?.data?.message ||
            "Notifications could not be loaded."
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, POLL_INTERVAL_MS);

    const handleFocus = () => {
      loadNotifications({ silent: true });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const visibleUnreadCount = useMemo(() => {
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  const handleToggle = () => {
    setOpen((previous) => {
      const next = !previous;

      if (next) {
        loadNotifications();
      }

      return next;
    });
  };

  const markReadLocally = (notificationId) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        String(getNotificationId(notification)) === String(notificationId)
          ? {
              ...notification,
              isRead: true,
              readAt: notification.readAt || new Date().toISOString(),
            }
          : notification
      )
    );

    setUnreadCount((previous) => Math.max(previous - 1, 0));
  };

  const handleNotificationClick = async (notification) => {
    const notificationId = getNotificationId(notification);

    if (notificationId && !notification.isRead) {
      markReadLocally(notificationId);

      try {
        await markNotificationAsRead(notificationId);
      } catch (requestError) {
        console.error("Mark notification read error:", requestError);
        loadNotifications({ silent: true });
      }
    }

    setOpen(false);

    const targetRoute = String(notification.relatedRoute || "").trim();

    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead();
    } catch (requestError) {
      console.error("Mark all notifications read error:", requestError);
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setError(
        requestError?.response?.data?.message ||
          "Could not mark all notifications as read."
      );
    }
  };

  const handleDelete = async (event, notification) => {
    event.stopPropagation();

    const notificationId = getNotificationId(notification);

    if (!notificationId) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((previous) =>
      previous.filter(
        (item) =>
          String(getNotificationId(item)) !== String(notificationId)
      )
    );

    if (!notification.isRead) {
      setUnreadCount((previous) => Math.max(previous - 1, 0));
    }

    try {
      await deleteNotification(notificationId);
    } catch (requestError) {
      console.error("Delete notification error:", requestError);
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setError(
        requestError?.response?.data?.message ||
          "Could not delete notification."
      );
    }
  };

  return (
    <div className="notification-bell-wrap" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className="notification-bell-icon" aria-hidden="true">
          🔔
        </span>

        {unreadCount > 0 && (
          <span className="notification-unread-badge">
            {visibleUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="notification-panel"
          aria-label="Notifications"
        >
          <div className="notification-panel-header">
            <div>
              <span className="notification-panel-eyebrow">
                Updates
              </span>
              <h2>Notifications</h2>
            </div>

            <button
              type="button"
              className="notification-mark-all-button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          <div className="notification-panel-summary">
            {unreadCount > 0
              ? `${unreadCount} unread notification${
                  unreadCount === 1 ? "" : "s"
                }`
              : "You are all caught up"}
          </div>

          {error && (
            <div className="notification-error-message">
              {error}
            </div>
          )}

          <div className="notification-list">
            {loading && notifications.length === 0 ? (
              <div className="notification-empty-state">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty-state">
                <span aria-hidden="true">🔕</span>
                <strong>No notifications yet</strong>
                <p>New school updates will appear here.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const notificationId = getNotificationId(notification);

                return (
                  <article
                    key={notificationId}
                    className={`notification-item ${
                      notification.isRead ? "is-read" : "is-unread"
                    }`}
                  >
                    <button
                      type="button"
                      className="notification-item-main"
                      onClick={() =>
                        handleNotificationClick(notification)
                      }
                    >
                      <span
                        className="notification-item-icon"
                        aria-hidden="true"
                      >
                        {getNotificationIcon(notification.type)}
                      </span>

                      <span className="notification-item-copy">
                        <strong>
                          {notification.title || "Notification"}
                        </strong>

                        <span className="notification-item-message">
                          {notification.message || ""}
                        </span>

                        <span className="notification-item-meta">
                          {notification.senderName
                            ? `${notification.senderName} • `
                            : ""}
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>

                      {!notification.isRead && (
                        <span
                          className="notification-unread-dot"
                          aria-label="Unread"
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      className="notification-delete-button"
                      aria-label="Delete notification"
                      title="Delete notification"
                      onClick={(event) =>
                        handleDelete(event, notification)
                      }
                    >
                      ×
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
