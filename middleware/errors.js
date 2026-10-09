export function errorResponse(status, message) {
  return { status, error: message };
}

export function formatError(error) {
  return { error: error?.message || 'The request could not be completed.' };
}

export function apiError(status, message) {
  return { status, error: message };
}

export function handleApiError(error) {
  return { error: error?.message || 'The request could not be completed.' };
}

export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
