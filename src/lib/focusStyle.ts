import { supabase } from "./supabase";
import type { FocusStyle } from "../types";

let focusStyleWriteQueue: Promise<void> = Promise.resolve();

/**
 * Serializes device-local focus-style writes so rapid changes cannot complete
 * out of order and leave the server on an older selection.
 */
export function persistFocusStyle(
  userId: string,
  style: FocusStyle,
): Promise<void> {
  const operation = focusStyleWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const { error } = await supabase
        .from("users")
        .update({
          focus_style: style,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw error;
    });

  focusStyleWriteQueue = operation.catch(() => undefined);
  return operation;
}
