"use client";
import { useEffect } from "react";

/**
 * Hook to handle global errors
 */
export function useErrorHandler() {
    useEffect(() => {
        const handleError = (error: Error | ErrorEvent | PromiseRejectionEvent) => {
            console.error("Unhandled error:", error);
        };

        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleError);

        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleError);
        };
    }, []);
}
