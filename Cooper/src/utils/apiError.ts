// Shared parser for the API's error envelope: { error: { code, message } }.
// Centralizing this avoids each call site guessing at the wrong response
// shape (a recurring bug was reading error.response.data.message instead
// of the actual error.response.data.error.message).

export type ApiErrorInfo = {
  status?: number;
  code?: string;
  message: string;
  retryAfter?: number;
};

export function parseApiError(error: any, fallback = 'Something went wrong. Please try again.'): ApiErrorInfo {
  if (error?.code === 'ECONNABORTED') {
    return { message: 'Request timed out. Please check your connection and try again.' };
  }
  if (error?.message === 'Network Error') {
    return { message: 'No internet connection. Please check your network.' };
  }

  const status = error?.response?.status;
  const apiError = error?.response?.data?.error;
  const retryAfter = apiError?.retryAfter ?? error?.response?.data?.retryAfter;

  if (apiError?.code || apiError?.message) {
    return { status, code: apiError.code, message: apiError.message || fallback, retryAfter };
  }

  return { status, message: fallback };
}

export function formatRetryAfter(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
