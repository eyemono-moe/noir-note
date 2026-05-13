type ResolvedImageStatus = "loading" | "ready" | "missing";

type ResolvedImageState = {
  status: ResolvedImageStatus;
  src: string | null;
};

type ResolveImageStateInput = {
  url: string | null | undefined;
  objectUrl: string | null | undefined;
  loading: boolean;
};

const ATTACHMENT_URL_PREFIX = "attachment://";

function isAttachmentImageUrl(url: string | null | undefined): url is string {
  return !!url?.startsWith(ATTACHMENT_URL_PREFIX);
}

export function getAttachmentImageId(url: string | null | undefined): string | null {
  return isAttachmentImageUrl(url) ? url.slice(ATTACHMENT_URL_PREFIX.length) : null;
}

export function getResolvedImageState(input: ResolveImageStateInput): ResolvedImageState {
  if (!input.url) return { status: "loading", src: null };
  if (!isAttachmentImageUrl(input.url)) return { status: "ready", src: input.url };
  if (input.objectUrl) return { status: "ready", src: input.objectUrl };
  if (input.loading) return { status: "loading", src: null };
  return { status: "missing", src: null };
}
