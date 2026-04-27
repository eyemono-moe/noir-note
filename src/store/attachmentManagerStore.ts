import { createSignal } from "solid-js";

const [isOpen, setIsOpen] = createSignal(false);

export const useAttachmentManagerOpen = () => isOpen;
export const openAttachmentManager = () => setIsOpen(true);
export const closeAttachmentManager = () => setIsOpen(false);
