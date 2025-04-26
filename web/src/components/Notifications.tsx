import React from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Export the ToastContainer component to be used in App.tsx
export const Notifications = () => (
  <ToastContainer
    position="top-right"
    autoClose={5000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    rtl={false}
    pauseOnFocusLoss
    draggable
    pauseOnHover
    theme="light"
  />
);

// Helper functions for showing different types of notifications
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast.info(message),
  warning: (message: string) => toast.warning(message),
  loading: (message: string = 'Loading...') => toast.loading(message),
  update: (toastId: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    toast.update(toastId, {
      render: message,
      type: toast.TYPE[type.toUpperCase() as keyof typeof toast.TYPE],
      isLoading: false,
      autoClose: 5000
    });
  },
  dismiss: (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }
};
