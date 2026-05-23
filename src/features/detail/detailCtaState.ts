export type DetailCtaState =
  | "enabled"
  | "disabled"
  | "loading"
  | "success"
  | "failure"
  | "reason";

export type DetailCtaTone = "primary" | "muted" | "success" | "danger";

export type DetailCtaPresentation = {
  disabled: boolean;
  state: DetailCtaState;
  tone: DetailCtaTone;
};

export type DetailCtaStateInput = {
  blockedReason?: string;
  clickable?: boolean;
  failure?: boolean;
  loading?: boolean;
  success?: boolean;
};

export function resolveDetailCtaPresentation(state: DetailCtaState): DetailCtaPresentation {
  switch (state) {
    case "disabled":
      return { disabled: true, state, tone: "muted" };
    case "loading":
      return { disabled: true, state, tone: "primary" };
    case "success":
      return { disabled: true, state, tone: "success" };
    case "failure":
      return { disabled: false, state, tone: "danger" };
    case "reason":
      return { disabled: true, state, tone: "muted" };
    case "enabled":
    default:
      return { disabled: false, state: "enabled", tone: "primary" };
  }
}

export function selectDetailCtaState(input: DetailCtaStateInput): DetailCtaState {
  if (input.loading) return "loading";
  if (input.success) return "success";
  if (input.failure) return "failure";
  if (input.blockedReason) return "reason";
  if (input.clickable === false) return "disabled";
  return "enabled";
}
