import i18n from "@/core/i18n";

/**
 * Translate backend error messages to localized messages
 * @param {string} backendMessage - Message from backend
 * @returns {string} - Translated message
 */
export function translateErrorMessage(backendMessage) {
  if (!backendMessage) {
    return i18n.global.t("errors.unknownError");
  }

  // Pattern matching for common error patterns
  const patterns = [
    // Permission errors - more flexible pattern matching
    {
      pattern: /No permission.*?([a-z]+)\s+([a-z-]+)/i,
      handler: (match) => {
        const action = match[1]; // create, update, delete, view, etc.
        const resource = match[2]; // kpi, employee, department, etc.
        return i18n.global.t("errors.noPermission", {
          action: i18n.global.t(`common.${action}`),
          resource: i18n.global.t(`resources.${resource}`),
        });
      },
    },

    // More specific permission patterns
    {
      pattern: /No permission.*?create.*?kpi/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.create"),
          resource: i18n.global.t("resources.kpi"),
        }),
    },
    {
      pattern: /No permission.*?update.*?kpi/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.update"),
          resource: i18n.global.t("resources.kpi"),
        }),
    },
    {
      pattern: /No permission.*?delete.*?kpi/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.delete"),
          resource: i18n.global.t("resources.kpi"),
        }),
    },
    {
      pattern: /No permission.*?view.*?kpi/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.view"),
          resource: i18n.global.t("resources.kpi"),
        }),
    },
    {
      pattern: /No permission.*?create.*?employee/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.create"),
          resource: i18n.global.t("resources.employee"),
        }),
    },
    {
      pattern: /No permission.*?create.*?department/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.create"),
          resource: i18n.global.t("resources.department"),
        }),
    },
    {
      pattern: /No permission.*?create.*?formula/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.create"),
          resource: i18n.global.t("resources.formula"),
        }),
    },
    {
      pattern: /No permission.*?export.*?report/i,
      handler: () =>
        i18n.global.t("errors.noPermission", {
          action: i18n.global.t("common.export"),
          resource: i18n.global.t("resources.report"),
        }),
    },

    // Session errors
    {
      pattern: /Session expired/i,
      handler: () => i18n.global.t("errors.sessionExpired"),
    },
    {
      pattern: /Session invalid/i,
      handler: () => i18n.global.t("errors.sessionInvalid"),
    },
    {
      pattern: /Token expired/i,
      handler: () => i18n.global.t("errors.sessionExpired"),
    },
    {
      pattern: /concurrent/i,
      handler: () => i18n.global.t("errors.concurrentLogin"),
    },

    // Validation errors
    {
      pattern: /already exists/i,
      handler: () => i18n.global.t("errors.alreadyExists"),
    },
    {
      pattern: /not found/i,
      handler: () => i18n.global.t("errors.notFound"),
    },
    {
      pattern: /invalid.*?format/i,
      handler: () => i18n.global.t("errors.invalidFormat"),
    },
    {
      pattern: /required field/i,
      handler: () => i18n.global.t("errors.requiredField"),
    },

    // KPI specific errors
    {
      pattern: /Cannot.*?expired KPI/i,
      handler: () => i18n.global.t("errors.cannotSubmitExpiredKpi"),
    },
    {
      pattern: /Cannot delete KPI.*?scored/i,
      handler: () => i18n.global.t("errors.cannotDeleteScoredKpi"),
    },
    {
      pattern: /KPI.*?not started/i,
      handler: () => i18n.global.t("errors.kpiNotStarted"),
    },

    // Network/Server errors
    {
      pattern: /Network Error/i,
      handler: () => i18n.global.t("errors.networkError"),
    },
    {
      pattern: /Internal Server Error/i,
      handler: () => i18n.global.t("errors.internalServerError"),
    },
    {
      pattern: /Bad Request/i,
      handler: () => i18n.global.t("errors.badRequest"),
    },
  ];

  // Try to match patterns
  for (const { pattern, handler } of patterns) {
    const match = backendMessage.match(pattern);
    if (match) {
      try {
        return handler(match);
      } catch (error) {
        console.warn("Error translating message:", error);
        // Fallback to original message if translation fails
        return backendMessage;
      }
    }
  }

  // If no pattern matched, return original message
  // This allows new backend messages to still be displayed
  return backendMessage;
}

/**
 * Translate notification messages
 * @param {string} backendMessage - Message from backend
 * @returns {string} - Translated message
 */
export function translateNotificationMessage(backendMessage) {
  if (!backendMessage) {
    return i18n.global.t("notification.unknown");
  }

  const patterns = [
    {
      pattern: /KPI.*?assigned to you/i,
      handler: () => i18n.global.t("notification.kpiAssigned"),
    },
    {
      pattern: /KPI.*?approved/i,
      handler: () => i18n.global.t("notification.kpiApproved"),
    },
    {
      pattern: /KPI.*?rejected/i,
      handler: () => i18n.global.t("notification.kpiRejected"),
    },
    {
      pattern: /review.*?completed/i,
      handler: () => i18n.global.t("notification.reviewCompleted"),
    },
    {
      pattern: /Employee.*?has self-reviewed/i,
      handler: () => i18n.global.t("notification.employeeSelfReviewed"),
    },
    {
      pattern: /waiting for.*?approval/i,
      handler: () => i18n.global.t("notification.waitingForApproval"),
    },
    {
      pattern: /has been manager reviewed/i,
      handler: () => i18n.global.t("notification.managerReviewed"),
    },
    {
      pattern: /has provided feedback/i,
      handler: () => i18n.global.t("notification.feedbackProvided"),
    },
  ];

  for (const { pattern, handler } of patterns) {
    const match = backendMessage.match(pattern);
    if (match) {
      try {
        return handler(match);
      } catch (error) {
        console.warn("Error translating notification:", error);
        return backendMessage;
      }
    }
  }

  return backendMessage;
}

/**
 * Translate any backend message (error or notification)
 * @param {string} backendMessage - Message from backend
 * @param {string} type - 'error' or 'notification'
 * @returns {string} - Translated message
 */
export function translateBackendMessage(backendMessage, type = "error") {
  if (type === "notification") {
    return translateNotificationMessage(backendMessage);
  }
  return translateErrorMessage(backendMessage);
}

/**
 * Get translated error message with fallback
 * @param {string} backendMessage - Message from backend
 * @returns {string} - Translated message or fallback
 */
export function getTranslatedErrorMessage(backendMessage) {
  const translated = translateErrorMessage(backendMessage);

  // If translation returned the same message (no pattern matched)
  // and it's not a known message, return a generic error
  if (
    translated === backendMessage &&
    !backendMessage.includes("No permission")
  ) {
    return i18n.global.t("errors.unknownError");
  }

  return translated;
}
